import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { connectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { Session } from './models/Session.js';
import { Profile } from './models/Profile.js';
import { Company } from './models/Company.js';
import { Job } from './models/Job.js';
import { Application } from './models/Application.js';

export async function createIndexes() {
  for (const model of [User, Session, Profile, Company, Job, Application]) await model.createIndexes();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await connectDatabase(); await createIndexes(); console.log('Database indexes created. Existing indexes and data were preserved.'); }
  catch (error) { console.error('Index creation failed:', error.name); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
