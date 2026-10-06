import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  website: { type: String, default: '' },
  industry: { type: String, default: '' },
  description: { type: String, default: '' },
  location: { type: String, default: '' },
  logo: { type: String, default: '' },
  logoPublicId: { type: String, select: false },
}, { timestamps: true });

export const Company = mongoose.model('Company', companySchema);
