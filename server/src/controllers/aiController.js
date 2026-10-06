import { generateJobDescription } from '../services/aiService.js';
import { data } from '../utils/errors.js';
export async function generateDescription(req, res) { data(res, await generateJobDescription(req.validatedBody)); }
