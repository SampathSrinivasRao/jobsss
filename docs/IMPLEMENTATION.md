# Hirelane implementation walkthrough

The complete application is implemented in this repository. Read the source in the order below to follow the build from the backend and MongoDB models through the React workflows. The [API reference](API.md) describes the HTTP contract.

## 1. File structure

```text
chinnu job/
├── package.json                 npm workspaces and shared commands
├── package-lock.json            reproducible dependency versions
├── server/
│   ├── .env.example             backend configuration template
│   ├── package.json
│   ├── src/
│   │   ├── server.js            database connection and HTTP startup
│   │   ├── app.js               Express middleware and route mounting
│   │   ├── config/              validated environment and MongoDB connection
│   │   ├── models/              User, Session, Profile, Company, Job, Application
│   │   ├── controllers/         HTTP workflows and ownership checks
│   │   ├── middleware/          authentication, role checks, validation, errors
│   │   ├── routes/              API routes
│   │   ├── services/            uploads, parsing, matching, AI integration
│   │   ├── validation/          Zod request schemas
│   │   ├── utils/               matching, extraction, and response helpers
│   │   ├── indexes.js           explicit production index creation
│   │   └── seed.js              explicitly invoked development fixtures
│   └── tests/                  backend verification
├── client/
│   ├── index.html
│   ├── package.json
│   ├── src/
│   │   ├── components/          shared UI and application shell
│   │   ├── context/             authenticated user state
│   │   ├── lib/                 API client and helpers
│   │   └── pages/               auth, seeker, and employer screens
│   └── dist/                   generated production build; not source-controlled
├── scripts/                    local development helpers
├── docs/
│   ├── IMPLEMENTATION.md
│   └── API.md
└── README.md
```

The server follows an MVC-style separation: Mongoose models represent persistence, controllers implement workflows, and the React client supplies the views. Services isolate external providers from route handlers.

## 2. Start with the backend server

Use Node.js 24 LTS and MongoDB 8, or a compatible MongoDB Atlas deployment. Run these commands from the repository root in PowerShell:

```powershell
npm ci
Copy-Item server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into `JWT_SECRET` in `server/.env`. Configure `MONGODB_URI` for your database. Do not use the example secret in a deployment.

Read [environment configuration](../server/src/config/env.js), [database setup](../server/src/config/database.js), [Express setup](../server/src/app.js), then [server startup](../server/src/server.js). Environment validation runs before the server begins accepting requests. The API listens on port 5000 by default, while Vite serves the development interface on port 5173 and proxies `/api` requests.

```powershell
npm run dev
```

Open <http://localhost:5173>. For the disposable development database and sample accounts, use `npm run dev:demo` instead. That mode uses real MongoDB through `mongodb-memory-server`; its database is temporary and downloads a MongoDB binary on first use. See the root [README](../README.md) for demo credentials.

## 3. Define the MongoDB schemas

The implemented models are:

| Model | Responsibility |
| --- | --- |
| [User](../server/src/models/User.js) | Identity, normalized email, hashed password, and immutable account role. |
| [Session](../server/src/models/Session.js) | Server-side session records for JWT revocation and expiry. |
| [Profile](../server/src/models/Profile.js) | A seeker's summary, skills, employment, education, and private resume metadata. |
| [Company](../server/src/models/Company.js) | Company information and ownership by an employer account. |
| [Job](../server/src/models/Job.js) | Employer-owned opening, salary range, location, skills, work arrangement, experience, and publication state. |
| [Application](../server/src/models/Application.js) | Candidate-to-job relationship, application snapshot, current stage, and stage history. |

The account relationship determines access; request bodies cannot choose a different owner. Unique indexes guard identity and application uniqueness at the database layer. Job indexes support publication filters, owner queries, and text searches. A single company profile belongs to each employer account in this implementation.

Do not equate a schema's `unique` option with input validation: the database index enforces uniqueness, and duplicate-key errors must be handled by the application. See the schema definitions for the exact compound index keys.

## 4. Add cookie authentication and role boundaries

Registration and login screens are separate for seekers and employers. The role is established at registration. Login verifies both credentials and the requested portal role. Passwords are hashed before persistence.

Successful authentication sets an HTTP-only cookie. React retrieves the safe user object through the API and never stores a JWT in local storage. Protected API routes verify the token and its session record, then check the account role. Employer job and applicant operations additionally constrain database queries by the authenticated owner.

State-changing browser requests are checked against the configured `CLIENT_URL` origin. An API client such as curl must include that `Origin` header too. In production, serve the frontend and API from the same HTTPS origin so the session cookie and origin policy work together. Secure cookie flags and HTTPS are described in [Express security guidance](https://expressjs.com/en/advanced/best-practice-security/).

## 5. Build the employer workflows

An employer completes the company profile, uploads a logo, then creates openings. Jobs include a title, description, skills, salary range, location, work arrangement, experience level, and lifecycle status. Editing and lifecycle actions update the stored opening. Paused and archived jobs stop appearing in the active seeker feed.

The applicant board groups applications by stage. Employers can filter the board, review the submitted profile, download an authorized resume, and move applicants between stages. Each change is saved to the application so the candidate sees the same status in their tracker. Applicant details and resumes are accessible only through the owning employer's application relationship.

The description generator calls Gemini from the backend. Add `GEMINI_API_KEY` and a model available to your account in `GEMINI_MODEL`. Generated text is returned as an editable draft; an employer must save or publish the job separately. This endpoint does not receive candidate resumes. Missing provider credentials produce an explicit unavailable response instead of generated-looking placeholder content.

## 6. Build the seeker workflows

The profile editor stores a summary, skills, work history, and education. Resume upload accepts supported PDF and DOCX files up to 5 MB. The backend extracts text, identifies recognized skills, and merges extracted skills into the profile. A candidate can review and edit the result. Text extraction does not perform OCR on scanned PDFs and is not guaranteed to infer every skill or reconstruct complete work history. Parsing covers the first 20 PDF pages and up to 100,000 characters, with a 15-second worker timeout. DOCX archives are inspected with a 20 MB expanded-size limit before extraction.

The job feed queries the API as search and filters change. Location, salary, work arrangement, and experience filters operate on persisted jobs. Match scores are explainable skills-overlap scores, calculated from required skills and the candidate's profile; they are not predictions of hiring success or an opaque AI assessment. Empty profiles should be completed before relying on those scores.

One-click application uses the saved profile and resume. The application stores submitted information for the employer to review. The tracker shows the persisted employer stage, refreshing while the page is open. This implementation uses periodic refresh rather than a WebSocket service.

## 7. Configure uploads and external services

Set these variables only in the backend environment:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=your-enabled-model
```

Resume uploads use authenticated Cloudinary delivery; the application checks access before issuing a download URL that expires after 60 seconds. Superseded resumes are retained so concurrent applications can preserve the exact submitted version. A scheduled retention process is not included and must account for application references before deleting assets. Company logos are intended to be public. Keep provider secrets out of all `VITE_*` variables: Vite exposes those values in browser bundles. Cloudinary's [private download documentation](https://cloudinary.com/documentation/control_access_to_media#providing_time_limited_access_to_private_media_assets) explains the expiry mechanism.

Provider-backed uploads and AI generation require working credentials and network connectivity. Account registration, company and job management, job search, profile editing, and application tracking do not require the AI provider. Upload functionality requires Cloudinary. Uploaded documents contain personal data, so configure provider retention and your application's privacy policy before public use.

## 8. Verify and build

```powershell
npm test
npm run lint
npm run build
```

Backend tests use an isolated MongoDB test database through `mongodb-memory-server`; the first run may need network access to obtain the binary. Browser tests are run separately with `npm run test:e2e` and require the browser installation described in the root README. A successful build creates `client/dist`.

For a local production build, set `NODE_ENV=production` and `CLIENT_URL=http://localhost:5000` in `server/.env`, then run `npm start`. For an external deployment, use an HTTPS `CLIENT_URL` instead and configure the reverse proxy accordingly. The production Express server serves the compiled React application and API together.

## 9. Configure a production server

The application runs directly with Node.js and MongoDB. Before starting against a production database, create its declared indexes with `npm run indexes -w server`. Run this as an explicit deployment step so text search and uniqueness constraints are available when requests begin. Mongoose documents the [production impact of automatic index creation](https://mongoosejs.com/docs/guide.html#indexes).

A public service needs TLS termination, a strong deployment secret, authenticated and backed-up database storage, and correctly configured trusted proxies. For multiple API replicas, replace process-local rate limit state with a shared store.

Live provider behavior, deployment load capacity, and operational recovery need verification in your own environment. The application lists currently return at most 500 matching records; pagination for larger applicant pipelines is not included. Email verification, password recovery, document malware scanning, automatic document retention, and administrative moderation are not included in this implementation.
