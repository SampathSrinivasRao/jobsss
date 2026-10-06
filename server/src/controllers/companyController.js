import { Company } from '../models/Company.js';
import { data } from '../utils/errors.js';
import { uploadLogoFile, removeAsset } from '../services/storageService.js';

export async function ensureCompany(user) {
  return Company.findOneAndUpdate({ owner: user._id }, { $setOnInsert: { owner: user._id, name: user.name } }, { upsert: true, new: true, runValidators: true });
}
export async function getCompany(req, res) { data(res, await ensureCompany(req.user)); }
export async function updateCompany(req, res) {
  data(res, await Company.findOneAndUpdate({ owner: req.user._id }, { $set: req.validatedBody }, { upsert: true, new: true, runValidators: true }));
}
export async function uploadLogo(req, res) {
  const result = await uploadLogoFile(req.file);
  const company = await Company.findOne({ owner: req.user._id }).select('+logoPublicId') || await ensureCompany(req.user);
  const previous = company.logoPublicId;
  company.logo = result.secure_url; company.logoPublicId = result.public_id;
  try { await company.save(); }
  catch (error) { await removeAsset(result.public_id, 'image', 'upload'); throw error; }
  if (previous) await removeAsset(previous, 'image', 'upload');
  const safe = company.toObject(); delete safe.logoPublicId;
  data(res, safe);
}
