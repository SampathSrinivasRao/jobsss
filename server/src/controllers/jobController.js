import { Job } from '../models/Job.js';
import { Company } from '../models/Company.js';
import { Profile } from '../models/Profile.js';
import { Application } from '../models/Application.js';
import { AppError, data, escapeRegex, notFound } from '../utils/errors.js';
import { matchSkills, normalizeSkill } from '../utils/skills.js';

const companyFields = 'name logo location industry website description';
export async function listJobs(req, res) {
  const { q, location, jobType, experienceLevel, salaryMin, currency, sort, page, limit } = req.validatedQuery;
  const filter = { status: 'active' };
  if (q) filter.$text = { $search: q };
  if (location) filter.location = { $regex: escapeRegex(location), $options: 'i' };
  if (jobType) filter.jobType = jobType;
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (salaryMin !== undefined) filter.salaryMax = { $gte: salaryMin };
  if (currency) filter.currency = currency;
  const profile = req.user?.role === 'seeker' ? await Profile.findOne({ user: req.user._id }).lean() : null;
  const profileKeys = [...new Set((profile?.skills || []).map(normalizeSkill))];
  const scoreStage = { $addFields: { calculatedMatch: {
    $cond: [{ $gt: [{ $size: '$skillKeys' }, 0] },
      { $multiply: [{ $divide: [{ $size: { $setIntersection: ['$skillKeys', profileKeys] } }, { $size: '$skillKeys' }] }, 100] }, 0],
  } } };
  const sortFields = sort === 'salary' ? { salaryMax: -1, createdAt: -1, _id: -1 } : sort === 'match' ? { calculatedMatch: -1, createdAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const pipeline = [{ $match: filter }];
  if (sort === 'match') pipeline.push(scoreStage);
  pipeline.push({ $sort: sortFields }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { skillKeys: 0, calculatedMatch: 0, __v: 0 } });
  const [rawJobs, total] = await Promise.all([Job.aggregate(pipeline).option({ maxTimeMS: 10000 }), Job.countDocuments(filter).maxTimeMS(10000)]);
  const jobs = await Job.populate(rawJobs, { path: 'company', select: companyFields });
  data(res, { jobs: jobs.map(job => ({ ...job, ...matchSkills(job.skills, profile?.skills) })), total, page, pages: Math.ceil(total / limit) });
}
export async function getJob(req, res) {
  const job = await Job.findById(req.params.id).populate('company', companyFields).lean();
  if (!job) throw notFound('Job not found');
  if (job.status !== 'active' && String(job.employer) !== String(req.user?._id)) {
    const submitted = req.user?.role === 'seeker' && await Application.exists({ job: job._id, applicant: req.user._id });
    if (!submitted) throw notFound('Job not found');
  }
  const profile = req.user?.role === 'seeker' ? await Profile.findOne({ user: req.user._id }).lean() : null;
  data(res, { ...job, ...matchSkills(job.skills, profile?.skills) });
}
export async function employerJobs(req, res) {
  const [jobs, counts] = await Promise.all([
    Job.find({ employer: req.user._id }).populate('company', companyFields).sort({ createdAt: -1 }).lean(),
    Application.aggregate([{ $match: { employer: req.user._id } }, { $group: { _id: '$job', count: { $sum: 1 } } }]),
  ]);
  const byJob = new Map(counts.map(c => [String(c._id), c.count]));
  data(res, jobs.map(job => ({ ...job, applicantsCount: byJob.get(String(job._id)) || 0 })));
}
export async function createJob(req, res) {
  const company = await Company.findOne({ owner: req.user._id });
  if (!company) throw new AppError(422, 'Complete your company profile before posting a job');
  const job = await Job.create({ ...req.validatedBody, employer: req.user._id, company: company._id });
  await job.populate('company', companyFields);
  data(res, job, 201);
}
export async function updateJob(req, res) {
  const job = await Job.findOne({ _id: req.params.id, employer: req.user._id });
  if (!job) throw notFound('Job not found');
  Object.assign(job, req.validatedBody);
  await job.save();
  await job.populate('company', companyFields);
  data(res, job);
}
export async function archiveJob(req, res) {
  const job = await Job.findOneAndUpdate({ _id: req.params.id, employer: req.user._id }, { $set: { status: 'archived' } }, { new: true });
  if (!job) throw notFound('Job not found');
  data(res, job);
}
