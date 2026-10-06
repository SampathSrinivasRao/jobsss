import { z } from 'zod';

const text = (max = 160) => z.string().trim().max(max);
const required = (max = 160) => text(max).min(1);
const date = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}(?:-\d{2})?$/, 'Use YYYY-MM or YYYY-MM-DD')]).default('');
export const skillsSchema = z.array(required(60)).max(50).transform(skills => [...new Set(skills)]);
export const registerSchema = z.object({
  name: required(100),
  email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(12, 'Use at least 12 characters').max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password exceeds 72 UTF-8 bytes'),
  role: z.enum(['seeker', 'employer']),
});
export const loginSchema = registerSchema.pick({ email: true, role: true }).extend({ password: z.string().min(1).max(200) });
export const profileSchema = z.object({
  headline: text(160).default(''), location: text(160).default(''), summary: text(5000).default(''),
  skills: skillsSchema.default([]),
  experience: z.array(z.object({ title: required(), company: required(), startDate: date, endDate: date, description: text(3000).default('') })).max(30).default([]),
  education: z.array(z.object({ school: required(), degree: required(), startDate: date, endDate: date })).max(20).default([]),
});
const website = z.union([z.literal(''), z.string().url().max(500).refine(v => /^https?:\/\//i.test(v), 'Website must use HTTP or HTTPS')]);
export const companySchema = z.object({
  name: required(120), website: website.default(''), industry: text(100).default(''),
  description: text(8000).default(''), location: text(160).default(''),
});
export const jobSchema = z.object({
  title: required(160), description: z.string().trim().min(50, 'Write at least 50 characters').max(16000),
  skills: skillsSchema,
  salaryMin: z.number().finite().min(0).max(1000000000), salaryMax: z.number().finite().min(0).max(1000000000),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP']).default('USD'),
  location: required(160), jobType: z.enum(['Remote', 'Hybrid', 'Onsite']),
  experienceLevel: z.enum(['Entry', 'Mid', 'Senior', 'Lead']),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contract', 'Internship']).default('Full-time'),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
});
export const jobPatchSchema = jobSchema.partial().refine(v => Object.keys(v).length > 0, 'Include at least one job field');
export const searchSchema = z.object({
  q: text(100).optional(), location: text(160).optional(),
  jobType: z.enum(['Remote', 'Hybrid', 'Onsite']).optional(),
  experienceLevel: z.enum(['Entry', 'Mid', 'Senior', 'Lead']).optional(),
  salaryMin: z.coerce.number().finite().min(0).max(1000000000).optional(),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP']).optional(),
  sort: z.enum(['newest', 'salary', 'match']).default('newest'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export const statusSchema = z.object({ status: z.enum(['Applied', 'Shortlisted', 'Interviewing', 'Rejected', 'Hired']) });
export const applicantQuerySchema = z.object({
  jobId: z.string().regex(/^[a-f\d]{24}$/i).optional(), q: text(100).optional(),
  status: statusSchema.shape.status.optional(),
});
export const aiSchema = z.object({ title: required(160), skills: skillsSchema.optional(), experienceLevel: jobSchema.shape.experienceLevel.optional() });
