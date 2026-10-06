import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { extractSkills } from '../utils/skills.js';

cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });
const configured = () => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw new AppError(503, 'File storage is not configured. Ask the administrator to connect Cloudinary.');
};
export function validateResumeFile(file) {
  if (!file?.buffer || file.buffer.length < 5) throw new AppError(400, 'Choose a PDF or DOCX file');
  if (file.buffer.length > 5 * 1024 * 1024) throw new AppError(400, 'File exceeds the 5 MB upload limit');
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf' && file.buffer.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (ext !== '.docx' || file.buffer.readUInt32LE(0) !== 0x04034b50) throw new AppError(400, 'Only genuine PDF and DOCX files are supported');
  // Inspect the ZIP central directory before extraction, bounding decompression.
  let end = -1;
  for (let i = file.buffer.length - 22; i >= Math.max(0, file.buffer.length - 65557); i--) {
    if (file.buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new AppError(400, 'The DOCX archive is invalid');
  const entries = file.buffer.readUInt16LE(end + 10);
  let offset = file.buffer.readUInt32LE(end + 16);
  if (entries > 256 || file.buffer.readUInt16LE(end + 4) !== 0) throw new AppError(400, 'The DOCX archive is too complex');
  let expanded = 0;
  const names = new Set();
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || file.buffer.readUInt32LE(offset) !== 0x02014b50) throw new AppError(400, 'The DOCX archive is invalid');
    const compressed = file.buffer.readUInt32LE(offset + 20);
    const uncompressed = file.buffer.readUInt32LE(offset + 24);
    expanded += uncompressed;
    const nameLength = file.buffer.readUInt16LE(offset + 28);
    const extra = file.buffer.readUInt16LE(offset + 30);
    const comment = file.buffer.readUInt16LE(offset + 32);
    const name = file.buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    names.add(name);
    if ((file.buffer.readUInt16LE(offset + 8) & 1) || expanded > 20 * 1024 * 1024 || (uncompressed > 100000 && uncompressed / Math.max(compressed, 1) > 100) || /vbaProject|\.\./i.test(name)) throw new AppError(400, 'Encrypted, macro-enabled, or highly compressed documents are not supported');
    offset += 46 + nameLength + extra + comment;
  }
  if (!names.has('[Content_Types].xml') || !names.has('word/document.xml')) throw new AppError(400, 'The file is not a DOCX document');
  return 'docx';
}
export function parseResume(buffer, format) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./resumeWorker.js', import.meta.url), { workerData: { buffer, format }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    let settled = false;
    const done = (error, text) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      error ? reject(error) : resolve(text);
    };
    const timer = setTimeout(() => done(new AppError(422, 'This document took too long to parse. Try a simpler resume.')), 15000);
    worker.once('message', result => result.error ? done(new AppError(422, result.error)) : done(null, result.text));
    worker.once('error', () => done(new AppError(422, 'This document could not be parsed')));
    worker.once('exit', () => { if (!settled) done(new AppError(422, 'This document could not be parsed')); });
  });
}
function upload(buffer, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ ...options, timeout: 60000 }, (error, result) => {
      if (error) reject(new AppError(502, 'File storage is temporarily unavailable. Please try again.'));
      else resolve(result);
    }).end(buffer);
  });
}
export async function uploadResumeFile(file) {
  const format = validateResumeFile(file);
  configured();
  const text = await parseResume(file.buffer, format);
  if (!text.trim()) throw new AppError(422, 'No readable text was found. Scanned resumes need OCR before uploading.');
  const result = await upload(file.buffer, { resource_type: 'raw', type: 'authenticated', public_id: 'hirelane/resumes/' + randomUUID() + '.' + format, overwrite: false });
  return {
    resume: {
      publicId: result.public_id,
      originalName: path.basename(file.originalname).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150),
      format, mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: file.size, uploadedAt: new Date(),
    },
    skills: extractSkills(text),
  };
}
export function resumeDownloadUrl(resume) {
  if (!resume?.publicId) throw new AppError(404, 'No resume is available');
  configured();
  return cloudinary.utils.private_download_url(resume.publicId, '', { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: true });
}
export async function uploadLogoFile(file) {
  if (!file?.buffer?.length || file.buffer.length < 12) throw new AppError(400, 'Choose a PNG, JPEG, or WebP image');
  const b = file.buffer;
  const png = b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP';
  if (!png && !jpeg && !webp) throw new AppError(400, 'Only genuine PNG, JPEG, and WebP images are supported');
  configured();
  return upload(b, { resource_type: 'image', public_id: 'hirelane/logos/' + randomUUID(), overwrite: false, allowed_formats: ['png', 'jpg', 'jpeg', 'webp'], transformation: [{ width: 512, height: 512, crop: 'limit' }, { fetch_format: 'webp' }] });
}
export async function removeAsset(publicId, resourceType, type) {
  try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type, invalidate: true }); }
  catch { /* Cleanup is best effort; a retention job should retry orphan removal. */ }
}
