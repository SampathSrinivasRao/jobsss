# Hirelane API reference

Base path: `/api`. Development runs on <http://localhost:5000>; Vite proxies browser requests from port 5173. The production build is served by Express on the same origin as the API.

## Authentication and request rules

The API authenticates with an HTTP-only session cookie. Browser requests use `credentials: 'include'`; do not send or persist a JWT in local storage. Obtain the current account from `GET /api/auth/me`.

Every state-changing request must include an `Origin` equal to the configured `CLIENT_URL`, including requests from non-browser clients. Browsers send this automatically. JSON requests use `Content-Type: application/json`. Upload requests use `FormData`, with the browser setting the multipart boundary.

API role values are `seeker` and `employer`. Job ownership and application ownership are checked separately from the role. An employer cannot access another employer's openings or candidates merely by guessing an identifier.

Successful responses use `{ "data": ... }`. Failures use `{ "message": "..." }` and may include validation `errors`. Identifiers are MongoDB ObjectId strings.

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Service/database readiness. |
| POST | `/auth/register` | Public | Register a seeker or employer. |
| POST | `/auth/login` | Public | Log into the selected role portal. |
| POST | `/auth/logout` | Public; optional session | Revoke the current session if present and clear its cookie. |
| GET | `/auth/me` | Authenticated | Retrieve the current safe user object. |
| GET | `/profile` | Seeker | Read the authenticated candidate's profile. |
| PUT | `/profile` | Seeker | Save candidate profile fields. |
| POST | `/profile/resume` | Seeker | Upload and parse a resume. |
| GET | `/profile/resume/download` | Seeker | Obtain access to the candidate's saved resume. |
| GET | `/company` | Employer | Read the employer's company profile. |
| PUT | `/company` | Employer | Save the employer's company profile. |
| POST | `/company/logo` | Employer | Upload a company logo. |
| GET | `/jobs` | Public; optional session | Search active jobs; seeker sessions receive personalized matching. |
| GET | `/jobs/:id` | Public; optional session | Retrieve a job and available match information. |
| POST | `/jobs` | Employer | Publish a new company opening. |
| PATCH | `/jobs/:id` | Owning employer | Edit an opening, pause it, or archive it. |
| DELETE | `/jobs/:id` | Owning employer | Remove an opening from publication; see lifecycle rules below. |
| POST | `/jobs/:id/apply` | Seeker | Apply using the saved profile and resume. |
| GET | `/applications` | Seeker | Retrieve the candidate's application tracker. |
| GET | `/employer/jobs` | Employer | Retrieve the employer's own openings. |
| GET | `/employer/applications` | Employer | Retrieve applicants for employer-owned jobs. |
| PATCH | `/applications/:id/status` | Owning employer | Update an applicant's stage. |
| GET | `/applications/:id/resume` | Applicant or owning employer | Obtain authorized access to the submitted resume. |
| POST | `/ai/job-description` | Employer | Generate an editable job-description draft through Gemini. |

## Register and log in

```json
{
  "name": "Sam Rivera",
  "email": "sam@example.com",
  "password": "choose-a-long-unique-password",
  "role": "seeker"
}
```

Employer registration uses `"role": "employer"`. Login sends `email`, `password`, and `role`. The frontend presents separate seeker and employer screens while these shared endpoints validate the requested role.

```js
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'sam@example.com',
    password: 'choose-a-long-unique-password',
    role: 'seeker',
  }),
});
if (!response.ok) throw new Error('Login failed');
```

The server sets the cookie through `Set-Cookie`. JavaScript cannot read its value.

Registration requires at least 12 password characters and a maximum of 72 UTF-8 bytes. Sessions expire after 24 hours. Logging out revokes the database session as well as removing the cookie.

## Job search

`GET /jobs` supports the following query parameters:

| Parameter | Meaning |
| --- | --- |
| `q` | MongoDB full-text search across title, description, skills, and location; maximum 100 characters. |
| `location` | Case-insensitive literal location substring. |
| `jobType` | `Remote`, `Hybrid`, or `Onsite`. |
| `experienceLevel` | `Entry`, `Mid`, `Senior`, or `Lead`. |
| `salaryMin` | Minimum acceptable salary: matches jobs whose maximum salary reaches this amount. |
| `currency` | Restrict salaries to `USD`, `INR`, `EUR`, or `GBP`. Combine with salary filters to avoid comparing different currencies. |
| `sort` | `newest` (default), `salary`, or `match`. |
| `page` | Page number, starting at 1. |
| `limit` | Page size, from 1 to 50; default 12. |

Example: `/api/jobs?q=React&jobType=Remote&currency=USD&salaryMin=90000&sort=match&page=1&limit=12`.

The response is `{ "data": { "jobs": [], "total": 0, "page": 1, "pages": 0 } }`, with actual job records and counts replacing those sample values. Match sorting is calculated before pagination, so it ranks the full filtered result set. Anonymous visitors have no candidate skill profile; their matching score is zero.

## Company and job payloads

`PUT /company` accepts editable company fields. Company ownership is assigned by the authenticated session.

```json
{
  "name": "Northstar Studio",
  "website": "https://example.com",
  "industry": "Technology",
  "description": "We create collaborative tools for distributed teams.",
  "location": "Bengaluru, India"
}
```

`POST /jobs` accepts:

```json
{
  "title": "Senior Frontend Engineer",
  "description": "Build accessible React interfaces for our collaboration product. Work with design and backend teams, improve frontend performance, and maintain automated tests.",
  "skills": ["React", "TypeScript", "CSS", "Git"],
  "salaryMin": 90000,
  "salaryMax": 130000,
  "currency": "USD",
  "location": "Remote",
  "jobType": "Remote",
  "experienceLevel": "Senior",
  "employmentType": "Full-time",
  "status": "active"
}
```

Salary values are annual amounts in the selected currency. Supported currencies are `USD`, `INR`, `EUR`, and `GBP`. No currency conversion is performed. `salaryMax` must be at least `salaryMin`.

| Field | Allowed values |
| --- | --- |
| `jobType` | `Remote`, `Hybrid`, `Onsite` |
| `experienceLevel` | `Entry`, `Mid`, `Senior`, `Lead` |
| `employmentType` | `Full-time`, `Part-time`, `Contract`, `Internship` |
| `status` | `active`, `paused`, `archived` |

`PATCH /jobs/:id` supports changes to editable fields. For example, `{"status":"paused"}` pauses a listing. Applicants already submitted remain part of the employer's tracking history. The delete action uses archival so existing applications keep a valid job reference.

## Candidate profile

`PUT /profile` accepts the candidate's editable profile. Resume storage metadata is assigned by the upload endpoint and cannot be supplied by a client.

```json
{
  "headline": "Frontend engineer",
  "location": "Hyderabad, India",
  "summary": "I build accessible, reliable web applications.",
  "skills": ["React", "JavaScript", "CSS"],
  "experience": [
    {
      "title": "Software Engineer",
      "company": "Example Labs",
      "startDate": "2023-06",
      "endDate": "",
      "description": "Built and maintained customer-facing applications."
    }
  ],
  "education": [
    {
      "school": "Example University",
      "degree": "B.Tech, Computer Science",
      "startDate": "2019-06",
      "endDate": "2023-05"
    }
  ]
}
```

Both upload endpoints accept one multipart field named `file`, up to 5 MB. Resumes must be PDF or DOCX; logos must be PNG, JPEG, or WebP. The backend checks file signatures rather than relying only on the submitted MIME type.

```js
const form = new FormData();
form.append('file', selectedFile);
const response = await fetch('/api/profile/resume', {
  method: 'POST',
  credentials: 'include',
  body: form,
});
const result = await response.json();
if (!response.ok) throw new Error(result.message);
```

Uploaded resumes are parsed for text and known skills. Extracted skills are suggestions based on a vocabulary, not an AI assessment. Scanned PDFs require a text layer; OCR is not included. Parsing considers the first 20 PDF pages and up to 100,000 text characters. DOCX archives are limited to 20 MB of declared expanded content and inspected before extraction. Parsing runs in a worker with a 15-second timeout.

Download endpoints return `{ "data": { "url": "..." } }`. The Cloudinary URL expires after 60 seconds and delivers an attachment. Application downloads preserve the resume version originally submitted. Superseded resumes are retained to avoid deleting an asset referenced by a concurrently submitted application; automated retention cleanup and malware scanning are not implemented.

## Applications and matching

`POST /jobs/:id/apply` uses the authenticated candidate's stored profile. It requires an uploaded resume, at least one profile skill, and an active job; no request body is required. Repeated applications to the same job are rejected by the database uniqueness constraint. Employers can see only applications linked to jobs they own.

Application stage changes use:

```json
{ "status": "Shortlisted" }
```

Allowed stages are `Applied`, `Shortlisted`, `Interviewing`, `Rejected`, and `Hired`. Employers can move applications to any allowed stage; changing the stage appends an entry to `statusHistory`.

`GET /employer/applications` supports `jobId`, `q` (candidate name, email, or skill), and `status` filters. Both application list endpoints currently return at most the 500 newest matching applications. These endpoints do not yet expose pagination; very large hiring pipelines require that extension. Job feed pagination is implemented separately.

Match scores are computed from distinct normalized skills:

```text
matchScore = round(matched required skills / total required skills × 100)
```

Every required skill has equal weight. Matching recognizes common aliases such as `React.js` and `React`. The API includes matched and missing skills with a method explanation. A job with no required skills receives a score of zero; that does not mean the candidate is unqualified. No candidate data is sent to Gemini for matching.

## AI description draft

`POST /ai/job-description` takes the employer's title and returns a draft. Configure `GEMINI_API_KEY` and `GEMINI_MODEL` on the server. The returned description is editable; generation does not publish or modify any opening.

```json
{ "title": "Senior Frontend Engineer" }
```

Optional inputs are `skills` and `experienceLevel`. A successful response contains `{ "data": { "description": "...", "skills": ["..."] } }`.

## Errors and operational behavior

Validation, authentication, ownership, duplicate-application, upload, and provider failures are surfaced as HTTP errors. Treat response error messages as text. The UI should retain unsaved form data on failure and should not pretend that an unavailable upload or AI call succeeded.

| Status | Typical meaning |
| --- | --- |
| `400` | Invalid input, resource ID, or upload format/size. |
| `401` | Missing/expired session or invalid credentials. |
| `403` | Incorrect role or untrusted request origin. |
| `404` | Missing record or record outside the caller's ownership. |
| `409` | Duplicate registration/application or conflicting concurrent edit. |
| `422` | Missing profile prerequisite or an unreadable resume. |
| `429` | API/provider rate limit reached. |
| `502` | External provider rejected the operation or returned an invalid result. |
| `503` | Provider not configured or database not ready. |
| `504` | AI generation timed out or could not connect. |

Cookie-protected responses and private download links must not be cached by a shared proxy. Live Cloudinary and Gemini integration checks require your own valid credentials. The development seed command and disposable demo database are not production provisioning flows.
