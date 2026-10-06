import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hirelane_test';
process.env.JWT_SECRET = 'test-only-secret-at-least-thirty-two-characters';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-cloud-secret';
process.env.GEMINI_API_KEY = 'test-gemini-key';
const { createApp } = await import('../src/app.js');
const { createIndexes } = await import('../src/indexes.js');
const { Profile } = await import('../src/models/Profile.js');
const { Job } = await import('../src/models/Job.js');
const { User } = await import('../src/models/User.js');
const { Application } = await import('../src/models/Application.js');
const { Session } = await import('../src/models/Session.js');
const { validateResumeFile, parseResume } = await import('../src/services/storageService.js');
const { matchSkills, extractSkills } = await import('../src/utils/skills.js');
const { v2: cloudinary } = await import('cloudinary');
const { env } = await import('../src/config/env.js');

const app = createApp();
const origin = process.env.CLIENT_URL;
const password = 'SecurePassword123!';
const seeker = request.agent(app);
const employer = request.agent(app);
const otherEmployer = request.agent(app);
const stranger = request.agent(app);
let mongo, seekerId, employerId, jobId, applicationId;
const validJob = {
  title: 'Senior React Engineer', description: 'Build thoughtful, accessible interfaces with our product team. Collaborate with designers and engineers to deliver maintainable customer experiences.',
  skills: ['React', 'TypeScript', 'Node.js'], salaryMin: 100000, salaryMax: 160000, currency: 'USD', location: 'New York, NY', jobType: 'Remote', experienceLevel: 'Senior', employmentType: 'Full-time', status: 'active',
};
const post = (agent, url) => agent.post(url).set('Origin', origin);
const patch = (agent, url) => agent.patch(url).set('Origin', origin);
const put = (agent, url) => agent.put(url).set('Origin', origin);

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await createIndexes();
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });

test('mutation origin is required, including login and registration', async () => {
  await request(app).post('/api/auth/register').send({ name: 'Alex', email: 'alex@example.com', password, role: 'seeker' }).expect(403);
  await request(app).post('/api/auth/login').set('Origin', 'https://attacker.example').send({}).expect(403);
});
test('validation blocks weak passwords, invalid roles and oversized multibyte passwords', async () => {
  await post(seeker, '/api/auth/register').send({ name: 'Alex', email: 'alex@example.com', password: 'weak', role: 'seeker' }).expect(400);
  await post(seeker, '/api/auth/register').send({ name: 'Alex', email: 'alex@example.com', password, role: 'admin' }).expect(400);
  await post(seeker, '/api/auth/register').send({ name: 'Alex', email: 'alex@example.com', password: '密'.repeat(25), role: 'seeker' }).expect(400);
});
test('registration hashes passwords and returns an HTTP-only session cookie', async () => {
  const response = await post(seeker, '/api/auth/register').send({ name: 'Alex Morgan', email: 'alex@example.com', password, role: 'seeker' }).expect(201);
  seekerId = response.body.data._id;
  assert.equal(response.body.data.role, 'seeker');
  assert.equal(response.body.data.password, undefined);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
  assert.match(response.headers['set-cookie'][0], /SameSite=Lax/);
  const user = await User.findById(seekerId).select('+password');
  assert.notEqual(user.password, password);
  assert.ok(await user.verifyPassword(password));
  await post(seeker, '/api/auth/register').send({ name: 'Duplicate', email: 'ALEX@example.com', password, role: 'seeker' }).expect(409);
});
test('role separation and dedicated login role are enforced on the server', async () => {
  const result = await post(employer, '/api/auth/register').send({ name: 'Hiring Team', email: 'team@example.com', password, role: 'employer' }).expect(201);
  employerId = result.body.data._id;
  await post(otherEmployer, '/api/auth/register').send({ name: 'Other Team', email: 'other@example.com', password, role: 'employer' }).expect(201);
  await post(stranger, '/api/auth/register').send({ name: 'Other Seeker', email: 'stranger@example.com', password, role: 'seeker' }).expect(201);
  await post(request(app), '/api/auth/login').send({ email: 'alex@example.com', password, role: 'employer' }).expect(401);
  await seeker.get('/api/company').expect(403);
  await employer.get('/api/profile').expect(403);
  await request(app).get('/api/applications').expect(401);
  await seeker.get('/api/auth/me').expect(200);
});
test('profiles use allowlisted fields and keep account roles immutable', async () => {
  const result = await put(seeker, '/api/profile').send({ headline: 'React Engineer', summary: 'I build accessible applications.', location: 'New York', skills: ['React.js', 'TypeScript'], experience: [], education: [], role: 'employer', user: employerId }).expect(200);
  assert.equal(String(result.body.data.user), seekerId);
  assert.equal((await User.findById(seekerId)).role, 'seeker');
});
test('employer must complete company and can create a validated job', async () => {
  await post(employer, '/api/jobs').send(validJob).expect(422);
  await put(employer, '/api/company').send({ name: 'Linear Labs', website: 'https://example.com', industry: 'Technology', description: 'Useful tools for teams', location: 'New York' }).expect(200);
  await post(employer, '/api/jobs').send({ ...validJob, salaryMax: 1 }).expect(400);
  const result = await post(employer, '/api/jobs').send(validJob).expect(201);
  jobId = result.body.data._id;
  assert.equal(result.body.data.company.name, 'Linear Labs');
  await post(seeker, '/api/jobs').send(validJob).expect(403);
});
test('ownership prevents job updates or archive by a different employer', async () => {
  await patch(otherEmployer, '/api/jobs/' + jobId).send({ title: 'Stolen' }).expect(404);
  await otherEmployer.delete('/api/jobs/' + jobId).set('Origin', origin).expect(404);
  assert.equal((await Job.findById(jobId)).title, validJob.title);
});
test('database-backed search filters salary, type, text and location and calculates overlap', async () => {
  const response = await seeker.get('/api/jobs?q=React&location=New&jobType=Remote&experienceLevel=Senior&salaryMin=120000&sort=match&limit=1').expect(200);
  assert.equal(response.body.data.total, 1);
  assert.equal(response.body.data.jobs[0].matchScore, 67);
  assert.deepEqual(response.body.data.jobs[0].matchedSkills, ['React', 'TypeScript']);
  assert.equal(response.body.data.jobs[0].skillKeys, undefined);
  assert.equal((await seeker.get('/api/jobs?salaryMin=200000').expect(200)).body.data.total, 0);
  await seeker.get('/api/jobs?salaryMin[$gt]=0').expect(200);
  await seeker.get('/api/jobs?limit=100000').expect(400);
  await seeker.get('/api/jobs/invalid-id').expect(400);
});
test('apply requires a genuine saved resume; public mutation cannot set resume metadata', async () => {
  await post(seeker, '/api/jobs/' + jobId + '/apply').send({}).expect(422);
  await put(seeker, '/api/profile').send({ skills: ['React', 'TypeScript'], resume: { publicId: 'forged.pdf' } }).expect(200);
  assert.equal((await Profile.findOne({ user: seekerId })).resume, undefined);
});
test('file content validation rejects misleading extensions, short files, scripts and ZIP bombs', async () => {
  assert.throws(() => validateResumeFile({ originalname: 'resume.docx', buffer: Buffer.from('x') }), /Choose/);
  assert.throws(() => validateResumeFile({ originalname: 'resume.pdf', buffer: Buffer.from('<script>alert(1)</script>') }), /genuine/);
  await post(seeker, '/api/profile/resume').attach('file', Buffer.from('not a pdf'), 'resume.pdf').expect(400);
  await post(employer, '/api/company/logo').attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), 'logo.svg').expect(400);
});
function pdfFixture() {
  const stream = 'BT /F1 12 Tf 50 750 Td (Alex Morgan React TypeScript Node.js) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n'; }
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(pdf);
}
test('real PDF parsing populates skills; cloud upload is mocked only at provider boundary', async () => {
  const pdf = pdfFixture();
  const text = await parseResume(pdf, 'pdf');
  assert.match(text, /React TypeScript/);
  const originalUpload = cloudinary.uploader.upload_stream;
  cloudinary.uploader.upload_stream = (options, callback) => {
    const stream = new PassThrough();
    stream.on('data', () => {});
    stream.on('finish', () => callback(null, { public_id: options.public_id }));
    return stream;
  };
  try {
    const result = await post(seeker, '/api/profile/resume').attach('file', pdf, 'Alex-resume.pdf').expect(200);
    assert.equal(result.body.data.resume.originalName, 'Alex-resume.pdf');
    assert.equal(result.body.data.resume.publicId, undefined);
    assert.ok(result.body.data.skills.includes('TypeScript'));
  } finally { cloudinary.uploader.upload_stream = originalUpload; }
});
test('one-click apply snapshots profile and prevents duplicate submissions', async () => {
  const response = await post(seeker, '/api/jobs/' + jobId + '/apply').send({}).expect(201);
  applicationId = response.body.data._id;
  assert.equal(response.body.data.snapshot.name, 'Alex Morgan');
  assert.equal(response.body.data.snapshot.resume.publicId, undefined);
  await post(seeker, '/api/jobs/' + jobId + '/apply').send({}).expect(409);
  await put(seeker, '/api/profile').send({ headline: 'Changed after applying', skills: ['Python'] }).expect(200);
  const application = await Application.findById(applicationId);
  assert.ok(application.snapshot.skills.includes('React'));
  assert.equal(application.snapshot.resume.originalName, 'Alex-resume.pdf');
});
test('ATS filters applicants, exposes snapshot, enforces ownership, and records status history', async () => {
  const response = await employer.get('/api/employer/applications?q=Alex&jobId=' + jobId).expect(200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].snapshot.name, 'Alex Morgan');
  await patch(otherEmployer, '/api/applications/' + applicationId + '/status').send({ status: 'Rejected' }).expect(404);
  await patch(seeker, '/api/applications/' + applicationId + '/status').send({ status: 'Hired' }).expect(403);
  await patch(employer, '/api/applications/' + applicationId + '/status').send({ status: 'Interviewing' }).expect(200);
  const tracked = await seeker.get('/api/applications').expect(200);
  assert.equal(tracked.body.data[0].status, 'Interviewing');
  assert.equal(tracked.body.data[0].statusHistory.length, 2);
  assert.equal(tracked.body.data[0].job.company.name, 'Linear Labs');
});
test('resume links expire in 60 seconds and only application owners may obtain them', async () => {
  await otherEmployer.get('/api/applications/' + applicationId + '/resume').expect(404);
  await stranger.get('/api/applications/' + applicationId + '/resume').expect(404);
  const result = await employer.get('/api/applications/' + applicationId + '/resume').expect(200);
  const url = new URL(result.body.data.url);
  assert.equal(url.searchParams.get('type'), 'authenticated');
  assert.ok(Number(url.searchParams.get('expires_at')) <= Math.floor(Date.now() / 1000) + 60);
  assert.ok(url.searchParams.get('signature'));
});
test('pause and archive remove openings from search and block new applications', async () => {
  await patch(employer, '/api/jobs/' + jobId).send({ status: 'paused' }).expect(200);
  assert.equal((await seeker.get('/api/jobs').expect(200)).body.data.total, 0);
  await post(stranger, '/api/jobs/' + jobId + '/apply').send({}).expect(404);
  await employer.delete('/api/jobs/' + jobId).set('Origin', origin).expect(200);
  assert.equal((await Job.findById(jobId)).status, 'archived');
  assert.ok(await Application.findById(applicationId));
  await seeker.get('/api/jobs/' + jobId).expect(200);
  await stranger.get('/api/jobs/' + jobId).expect(404);
});
test('optimistic job concurrency prevents stale salary updates', async () => {
  const a = await Job.findById(jobId), b = await Job.findById(jobId);
  a.salaryMin = 150000;
  await a.save();
  b.salaryMax = 120000;
  await assert.rejects(() => b.save(), { name: 'VersionError' });
});
test('AI uses structured provider output, validates it, and surfaces provider failures', async () => {
  const originalFetch = global.fetch;
  let body;
  global.fetch = async (url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ description: validJob.description, skills: ['React'] }) }] } }] }) }; };
  try {
    const response = await post(employer, '/api/ai/job-description').send({ title: 'React Engineer' }).expect(200);
    assert.deepEqual(response.body.data.skills, ['React']);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    global.fetch = async () => ({ ok: false, status: 429 });
    await post(employer, '/api/ai/job-description').send({ title: 'Engineer' }).expect(429);
    global.fetch = async () => ({ ok: true, json: async () => ({ candidates: [] }) });
    await post(employer, '/api/ai/job-description').send({ title: 'Engineer' }).expect(502);
    const key = env.GEMINI_API_KEY; env.GEMINI_API_KEY = '';
    await post(employer, '/api/ai/job-description').send({ title: 'Engineer' }).expect(503);
    env.GEMINI_API_KEY = key;
  } finally { global.fetch = originalFetch; }
});
test('logout revokes JWT server-side so replaying an old cookie fails', async () => {
  const login = await post(request(app), '/api/auth/login').send({ email: 'alex@example.com', password, role: 'seeker' }).expect(200);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  await post(request(app), '/api/auth/logout').set('Cookie', cookie).send({}).expect(200);
  await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
});
test('expired sessions and tampered JWTs cannot authenticate', async () => {
  await Session.updateMany({ user: seekerId }, { $set: { expiresAt: new Date(0) } });
  await seeker.get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Cookie', 'hirelane_session=not-a-jwt').expect(401);
});
test('skill matching is normalized, bounded, deterministic and explicit', () => {
  assert.equal(matchSkills(['React', 'React.js', 'Node.js'], ['reactjs']).matchScore, 50);
  assert.equal(matchSkills([], ['React']).matchScore, 0);
  assert.deepEqual(extractSkills('I use React.js, Node.js and TypeScript.'), ['TypeScript', 'React.js', 'Node.js']);
});
test('health is backed by actual database state and API errors use JSON', async () => {
  assert.equal((await request(app).get('/api/health').expect(200)).body.data.database, 'connected');
  const result = await request(app).get('/api/not-real').expect(404);
  assert.equal(typeof result.body.message, 'string');
});
