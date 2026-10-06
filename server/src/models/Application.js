import mongoose from 'mongoose';
import { resumeSchema, educationSchema, experienceSchema } from './Profile.js';

export const APPLICATION_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Rejected', 'Hired'];
const snapshotSchema = new mongoose.Schema({
  name: String, email: String, headline: String, location: String, summary: String,
  skills: [String], experience: [experienceSchema], education: [educationSchema], resume: resumeSchema,
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  snapshot: { type: snapshotSchema, required: true },
  status: { type: String, enum: APPLICATION_STATUSES, default: 'Applied' },
  statusHistory: [{ status: { type: String, enum: APPLICATION_STATUSES }, at: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true });

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
applicationSchema.index({ applicant: 1, createdAt: -1 });
applicationSchema.index({ employer: 1, job: 1, status: 1, createdAt: -1 });

export const Application = mongoose.model('Application', applicationSchema);

export function publicApplication(application) {
  const plain = application?.toObject ? application.toObject() : { ...application };
  if (plain.snapshot?.resume) {
    const { publicId, ...metadata } = plain.snapshot.resume;
    plain.snapshot = { ...plain.snapshot, resume: metadata };
  }
  return plain;
}
