import { Profile, publicProfile } from '../models/Profile.js';
import { data } from '../utils/errors.js';
import { uploadResumeFile, resumeDownloadUrl, removeAsset } from '../services/storageService.js';

export async function ensureProfile(userId) {
  return Profile.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId } }, { upsert: true, new: true, runValidators: true });
}
export async function getProfile(req, res) { data(res, publicProfile(await ensureProfile(req.user._id))); }
export async function updateProfile(req, res) {
  const profile = await Profile.findOneAndUpdate({ user: req.user._id }, { $set: req.validatedBody }, { upsert: true, new: true, runValidators: true });
  data(res, publicProfile(profile));
}
export async function uploadResume(req, res) {
  const uploaded = await uploadResumeFile(req.file);
  const profile = await ensureProfile(req.user._id);
  profile.resume = uploaded.resume;
  profile.skills = [...new Set([...profile.skills, ...uploaded.skills])].slice(0, 50);
  try { await profile.save(); }
  catch (error) { await removeAsset(uploaded.resume.publicId, 'raw', 'authenticated'); throw error; }
  // Keep earlier resume versions: a concurrent application may reference them.
  // A retention job can remove unreferenced versions after a safe grace period.
  data(res, { ...publicProfile(profile), extractedSkills: uploaded.skills });
}
export async function downloadResume(req, res) {
  const profile = await ensureProfile(req.user._id);
  data(res, { url: resumeDownloadUrl(profile.resume) });
}
