import { Job } from '../models/Job.js';
import { Profile } from '../models/Profile.js';
import { Application, publicApplication } from '../models/Application.js';
import { AppError, data, notFound, escapeRegex } from '../utils/errors.js';
import { resumeDownloadUrl } from '../services/storageService.js';

export async function apply(req, res) {
  const job = await Job.findOne({ _id: req.params.id, status: 'active' });
  if (!job) throw notFound('This job is no longer accepting applications');
  const profile = await Profile.findOne({ user: req.user._id }).lean();
  if (!profile?.resume) throw new AppError(422, 'Upload your resume before applying');
  if (!profile.skills.length) throw new AppError(422, 'Add at least one skill to your profile before applying');
  const { headline, location, summary, skills, experience, education, resume } = profile;
  try {
    const application = await Application.create({
      job: job._id, applicant: req.user._id, employer: job.employer,
      snapshot: { name: req.user.name, email: req.user.email, headline, location, summary, skills, experience, education, resume },
      statusHistory: [{ status: 'Applied' }],
    });
    data(res, publicApplication(application), 201);
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, 'You have already applied to this job');
    throw error;
  }
}
export async function myApplications(req, res) {
  const applications = await Application.find({ applicant: req.user._id })
    .populate({ path: 'job', populate: { path: 'company', select: 'name logo location industry' } })
    .sort({ createdAt: -1 }).limit(500);
  data(res, applications.map(publicApplication));
}
export async function employerApplications(req, res) {
  const { jobId, q, status } = req.validatedQuery;
  const filter = { employer: req.user._id };
  if (jobId) filter.job = jobId;
  if (status) filter.status = status;
  if (q) filter.$or = ['snapshot.name', 'snapshot.email', 'snapshot.skills'].map(field => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } }));
  const applications = await Application.find(filter).populate('applicant', 'name email')
    .populate('job', 'title status company').sort({ createdAt: -1 }).limit(500);
  data(res, applications.map(publicApplication));
}
export async function updateStatus(req, res) {
  const application = await Application.findOne({ _id: req.params.id, employer: req.user._id });
  if (!application) throw notFound('Application not found');
  if (application.status !== req.validatedBody.status) {
    application.status = req.validatedBody.status;
    application.statusHistory.push({ status: application.status });
    await application.save();
  }
  data(res, publicApplication(application));
}
export async function downloadApplicationResume(req, res) {
  const filter = { _id: req.params.id, [req.user.role === 'employer' ? 'employer' : 'applicant']: req.user._id };
  const application = await Application.findOne(filter);
  if (!application) throw notFound('Application not found');
  data(res, { url: resumeDownloadUrl(application.snapshot.resume) });
}
