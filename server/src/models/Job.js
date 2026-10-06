import mongoose from 'mongoose';
import { normalizeSkill } from '../utils/skills.js';

const jobSchema = new mongoose.Schema({
  employer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 16000 },
  skills: { type: [String], default: [] },
  skillKeys: { type: [String], default: [], select: false },
  salaryMin: { type: Number, required: true, min: 0 },
  salaryMax: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['USD', 'INR', 'EUR', 'GBP'], default: 'USD' },
  location: { type: String, required: true, maxlength: 160 },
  jobType: { type: String, enum: ['Remote', 'Hybrid', 'Onsite'], required: true },
  experienceLevel: { type: String, enum: ['Entry', 'Mid', 'Senior', 'Lead'], required: true },
  employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Internship'], default: 'Full-time' },
  status: { type: String, enum: ['active', 'paused', 'archived'], default: 'active' },
}, { timestamps: true, optimisticConcurrency: true });

jobSchema.index({ title: 'text', description: 'text', skills: 'text', location: 'text' }, { weights: { title: 10, skills: 5, location: 2, description: 1 }, name: 'job_search_text' });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ status: 1, jobType: 1, experienceLevel: 1, salaryMax: -1 });
jobSchema.index({ employer: 1, createdAt: -1 });
jobSchema.pre('validate', function () {
  this.skillKeys = [...new Set(this.skills.map(normalizeSkill))];
  if (this.salaryMax < this.salaryMin) this.invalidate('salaryMax', 'Maximum salary must be greater than or equal to minimum salary');
});

export const Job = mongoose.model('Job', jobSchema);
