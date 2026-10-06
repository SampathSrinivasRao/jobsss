import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { createIndexes } from './indexes.js';
import { User } from './models/User.js';
import { Profile } from './models/Profile.js';
import { Company } from './models/Company.js';
import { Job } from './models/Job.js';
import { Application } from './models/Application.js';

export async function seedDatabase() {
  if (env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production');
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Set SEED_PASSWORD to 12–72 UTF-8 bytes');
  await createIndexes();
  let seeker = await User.findOne({ email: 'seeker@hirelane.demo' });
  if (!seeker) seeker = await User.create({ name: 'Alex Morgan', email: 'seeker@hirelane.demo', password, role: 'seeker' });
  let employer = await User.findOne({ email: 'employer@hirelane.demo' });
  if (!employer) employer = await User.create({ name: 'Jordan Lee', email: 'employer@hirelane.demo', password, role: 'employer' });
  let company = await Company.findOne({ owner: employer._id });
  if (!company) company = await Company.create({ owner: employer._id, name: 'Linear Labs', website: 'https://example.com', industry: 'Software & Technology', description: 'A fictional product studio building thoughtful tools for ambitious teams. This company is included as clearly labeled development sample data.', location: 'San Francisco, CA' });
  let profile = await Profile.findOne({ user: seeker._id });
  if (!profile) profile = await Profile.create({ user: seeker._id, headline: 'Frontend developer & thoughtful problem solver', location: 'San Francisco, CA', summary: 'Frontend developer who enjoys turning complex problems into simple, accessible products. Experienced with React, TypeScript, and collaborative product teams.', skills: ['React', 'TypeScript', 'JavaScript', 'Node.js', 'CSS', 'Figma'], experience: [{ title: 'Frontend Developer', company: 'Bright Studio', startDate: '2023-06', endDate: '', description: 'Built accessible interfaces and reusable components with React and TypeScript.' }], education: [{ school: 'University of California', degree: 'B.S. Computer Science', startDate: '2019-09', endDate: '2023-05' }] });
  const listings = [
    ['Senior Frontend Engineer', ['React', 'TypeScript', 'CSS', 'JavaScript'], 'Remote', 'Senior', 'San Francisco, CA', 140000, 185000],
    ['Product Designer', ['Figma', 'Product Design', 'User Research', 'Design Systems'], 'Hybrid', 'Mid', 'New York, NY', 110000, 150000],
    ['Full Stack Developer', ['React', 'Node.js', 'MongoDB', 'TypeScript'], 'Remote', 'Mid', 'Austin, TX', 120000, 165000],
    ['Backend Engineer', ['Node.js', 'PostgreSQL', 'Docker', 'AWS'], 'Hybrid', 'Senior', 'Seattle, WA', 135000, 180000],
    ['Junior React Developer', ['React', 'JavaScript', 'HTML', 'CSS'], 'Onsite', 'Entry', 'Bengaluru, India', 65000, 90000],
    ['Design Systems Lead', ['Figma', 'React', 'Design Systems', 'Leadership'], 'Remote', 'Lead', 'London, UK', 150000, 195000],
    ['Data Analyst', ['SQL', 'Python', 'Tableau', 'Data Analysis'], 'Hybrid', 'Mid', 'Boston, MA', 90000, 125000],
    ['Developer Experience Engineer', ['TypeScript', 'Node.js', 'Communication', 'Git'], 'Remote', 'Mid', 'New York, NY', 125000, 170000],
    ['Mobile Engineer', ['React Native', 'TypeScript', 'React', 'REST'], 'Onsite', 'Senior', 'San Francisco, CA', 145000, 190000],
    ['Frontend Engineering Intern', ['JavaScript', 'React', 'CSS'], 'Hybrid', 'Entry', 'Austin, TX', 45000, 65000],
  ];
  const jobs = [];
  for (const [index, [title, skills, jobType, experienceLevel, location, salaryMin, salaryMax]] of listings.entries()) {
    let job = await Job.findOne({ employer: employer._id, title });
    if (!job) job = await Job.create({
      employer: employer._id, company: company._id, title, skills, jobType, experienceLevel, location, salaryMin, salaryMax, currency: 'USD',
      employmentType: title.includes('Intern') ? 'Internship' : 'Full-time',
      description: 'About the role\nJoin our collaborative product team as a ' + title + '. Help shape useful software with a focus on quality, accessibility, and real customer needs.\n\nWhat you will do\n• Work closely with engineers, designers, and product partners.\n• Own meaningful projects from discovery through delivery.\n• Share your thinking through clear documentation and thoughtful reviews.\n\nWhat you will bring\n• Practical experience with ' + skills.join(', ') + '.\n• Curiosity, clear communication, and a collaborative approach.\n• A portfolio of work that shows care for the details.\n\nThis is a fictional development sample, not a live vacancy.',
      createdAt: new Date(Date.now() - index * 86400000),
    });
    jobs.push(job);
  }
  for (const [index, status] of ['Applied', 'Shortlisted', 'Interviewing'].entries()) {
    if (!await Application.exists({ job: jobs[index]._id, applicant: seeker._id })) {
      const { headline, location, summary, skills, experience, education } = profile.toObject();
      await Application.create({ job: jobs[index]._id, applicant: seeker._id, employer: employer._id, snapshot: { name: seeker.name, email: seeker.email, headline, location, summary, skills, experience, education }, status, statusHistory: [{ status: 'Applied' }, ...(status === 'Applied' ? [] : [{ status }])] });
    }
  }
  console.log('Development samples ready: seeker@hirelane.demo and employer@hirelane.demo. Password is the SEED_PASSWORD you supplied. Existing data was preserved.');
  return { seeker, employer, company, jobs };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await connectDatabase(); await seedDatabase(); }
  catch (error) { console.error('Seed failed:', error.message); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
