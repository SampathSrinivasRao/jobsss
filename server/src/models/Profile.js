import mongoose from 'mongoose';

export const resumeSchema = new mongoose.Schema({
  publicId: { type: String, required: true },
  originalName: { type: String, required: true },
  format: { type: String, enum: ['pdf', 'docx'], required: true },
  mimeType: String,
  size: Number,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

export const experienceSchema = new mongoose.Schema({
  title: String, company: String, startDate: String, endDate: String, description: String,
}, { _id: false });

export const educationSchema = new mongoose.Schema({
  school: String, degree: String, startDate: String, endDate: String,
}, { _id: false });

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  headline: { type: String, default: '' },
  location: { type: String, default: '' },
  summary: { type: String, default: '' },
  skills: { type: [String], default: [] },
  experience: { type: [experienceSchema], default: [] },
  education: { type: [educationSchema], default: [] },
  resume: resumeSchema,
}, { timestamps: true });

export const Profile = mongoose.model('Profile', profileSchema);

export function publicProfile(profile) {
  const plain = profile?.toObject ? profile.toObject() : { ...profile };
  if (plain.resume) {
    const { publicId, ...metadata } = plain.resume;
    plain.resume = metadata;
  }
  return plain;
}
