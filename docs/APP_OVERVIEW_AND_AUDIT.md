# ZAYER Digital Application Overview and Read-Only Audit

## Scope and verification limits

This is a source-level review of the React/Vite client and Express/Mongoose API in the current workspace. It is not a penetration test, legal opinion, database inspection, or browser/device certification.

- The client production build was run with its output outside the repository: `npm run build --workspace zayer-digital-client -- --outDir C:\Users\Chaimouta\AppData\Local\Temp\zayer-full-audit-build`. **Passed**: Vite transformed 1,632 modules; output was 307.09 kB JS (94.12 kB gzip) and 64.19 kB CSS (11.60 kB gzip). This excludes public video assets.
- No server tests, server process, seed/sync command, database operation, `npm audit`, or real form submission was run. The auth test explicitly drops a database; see F-18.
- No browser-based route, responsive, accessibility, API-down, empty-database, or media-network test was run in this audit. Runtime behavior in these cases is marked **not verified**.
- The official Business Profile PDF and the named legacy HTML/PHP sources were not present in the repository files reviewed. Consequently, comparisons against those source documents are **not verified**; this report does not assert content discrepancies against them.
- `.env.example` files are present in this local workspace but ignored by Git; a fresh clone may not include them (F-08).
- Paths and line numbers below refer to the repository-relative file paths in the code blocks. Findings are based on the cited source unless explicitly marked “not verified.”

## Part 1 — How the application works

### 1. Product and users

ZAYER Digital is a public agency website backed by a REST API. Visitors can read agency information, browse database-backed services, projects and job listings, calculate a portfolio quote in the browser, submit contact inquiries and apply for jobs using a CV link. Registered users can sign in, but the current client has no user-facing account area or administration dashboard.

The API has admin-only routes for managing services, projects, jobs, applications, contact messages and users. Authorization is enforced by backend middleware; it is not safe to rely on the absence of admin screens as access control. The React app currently wires public pages and `/login` and `/register`, but no protected or admin route ( `client/src/App.jsx:20-34`; `server/routes/userRoutes.js:14-19`; `README.md:30-33`).

### 2. Important folder and file map

```text
client/
  index.html                         Vite HTML shell, default title/description and font loads
  vite.config.js                     Vite configuration
  src/main.jsx                       React root and application providers
  src/App.jsx                        Public, auth, privacy and not-found routes
  src/index.css                      Global design system and page styles
  src/layouts/PublicLayout.jsx       Shared public-page chrome
  src/components/common/ApiStates.jsx         Loading, error and empty state UI
  src/components/common/LanguageSwitcher.jsx  EN/FR control
  src/components/common/PageMeta.jsx          Client-side title and description
  src/components/common/PortfolioLightbox.jsx Portfolio media dialog
  src/components/common/ProtectedRoute.jsx    Protected/admin route guard helpers
  src/components/common/Reveal.jsx            Scroll reveal behavior
  src/components/common/ScrollProgress.jsx    Scroll progress indicator
  src/components/common/ScrollToTop.jsx       Route scroll reset
  src/components/common/Toast.jsx             Transient notification UI
  src/components/layout/Navbar.jsx            Primary navigation and mobile menu
  src/components/layout/Footer.jsx            Shared public footer
  src/components/cards/PortfolioMediaCard.jsx Project image/video/YouTube rendering
  src/components/cards/JobCard.jsx            Job card candidate (see F-14)
  src/components/cards/ProjectCard.jsx         Project card candidate (see F-14)
  src/components/cards/ServiceCard.jsx         Service card candidate (see F-14)
  src/components/cards/TeamCard.jsx            Team profile card
  src/components/sections/Hero.jsx             Home hero and background video
  src/components/sections/LegacyPageHero.jsx   Public interior-page hero
  src/components/sections/CTASection.jsx       Reusable call-to-action section
  src/components/sections/ProcessStep.jsx      Process component candidate (see F-14)
  src/components/sections/SectionTitle.jsx     Reusable section heading
  src/context/AuthContext.jsx        Client login state and token persistence
  src/context/LanguageContext.jsx    EN/FR selection and document language
  src/hooks/useApiResource.js        Shared loading/error/reload state for fetched resources
  src/hooks/useFocusTrap.js          Shared dialog keyboard focus management
  src/services/api.js                Fetch wrapper, bearer token, response/error parsing
  src/services/authService.js        Login, registration and current-user requests
  src/services/serviceService.js     Service collection/detail/management requests
  src/services/projectService.js     Project collection/detail/management requests
  src/services/jobService.js         Job collection/detail/management requests
  src/services/applicationService.js Application submission and admin requests
  src/services/contactService.js     Contact submission and admin requests
  src/services/userService.js        Admin user-management requests
  src/pages/public/Home.jsx          Home page
  src/pages/public/About.jsx         About page
  src/pages/public/Services.jsx      Services listing and services hero video
  src/pages/public/ServiceDetails.jsx Service detail page
  src/pages/public/Portfolio.jsx     Portfolio, filters and quote calculator
  src/pages/public/Careers.jsx       Job listings and application dialog
  src/pages/public/Contact.jsx        Contact information and form
  src/pages/public/PrivacyPolicy.jsx  Privacy notice
  src/pages/public/AuthPage.jsx       Login and registration
  src/pages/public/NotFound.jsx       404 page
  src/translations/en.js             English content and UI strings
  src/translations/fr.js             French content and UI strings
  src/data/officialServices.js       Official service labels/descriptions and language mapping
  src/data/jobs.js                   Legacy/static job data candidate (see F-14)
  src/data/projects.js               Legacy/static project data candidate (see F-14)
  src/data/services.js               Legacy/static service data candidate (see F-14)
  src/data/team.js                   Static team content candidate
  src/components/common/serviceIcons.js Service icon lookup
  public/videos/hero-1.mp4           Home hero background video
  public/videos/hero-2.mp4           Services hero background video
server/
  server.js                          Express setup, CORS, parsers, routes and error middleware
  config/env.js                      Required environment validation and defaults
  config/db.js                       Mongoose connection
  routes/authRoutes.js               Register, login and current-user routes
  routes/serviceRoutes.js             Service routes
  routes/projectRoutes.js             Project routes
  routes/jobRoutes.js                 Job routes
  routes/applicationRoutes.js         Public application and admin application routes
  routes/contactRoutes.js             Public contact and admin contact routes
  routes/userRoutes.js                Admin user routes
  controllers/authController.js       Registration/login/current-user handlers
  controllers/serviceController.js    Service queries and mutations
  controllers/projectController.js    Project queries and mutations
  controllers/jobController.js        Job queries and mutations
  controllers/applicationController.js Application submission/admin handlers
  controllers/contactController.js    Contact submission/admin handlers
  controllers/userController.js       Admin user handlers
  middleware/authMiddleware.js       JWT authentication
  middleware/adminMiddleware.js      Admin role authorization
  middleware/validationMiddleware.js ObjectId validation
  middleware/errorMiddleware.js      Not-found and error responses
  utils/apiQuery.js                  Pagination, filters, sorting, search and field allowlists
  utils/jwt.js                       JWT signing
  utils/passwordPolicy.js            Password length and bcrypt byte limit
  models/User.js                     User schema
  models/Service.js                  Service schema
  models/Project.js                  Project schema
  models/Job.js                      Job schema
  models/Application.js              Job application schema
  models/ContactMessage.js            Contact inquiry schema
  seed/                              Explicit admin seed and official-service sync scripts
  test/auth.test.js                  Auth integration test; drops its test database
  tests/officialServices.test.js     Official-service catalog test
package.json                         npm workspaces and root scripts
client/package.json                 Client scripts and dependencies
server/package.json                 Server scripts and dependencies
README.md                            Setup, API, phase boundary and content workflow
.gitignore                           Ignores node_modules, dist, .env, .env.* and logs
```

### 3. Request flows

The normal client data path is page/component → resource hook or service wrapper → `request()` → Express route → controller → Mongoose model → MongoDB. The API base URL comes from `VITE_API_URL` (`client/src/services/api.js:43-57`).

| Feature | Flow |
|---|---|
| Contact | `Contact.jsx` builds a `name` from first/last name and submits through `contactService.createContact` → `POST /api/contact` → `createContactMessage` allowlists fields → `ContactMessage.create` → MongoDB. The contact form includes a submit lock and reset/success/error UI (`Contact.jsx:23-46,99-122`; `contactService.js:3-6`; `contactRoutes.js:14-20`; `contactController.js:13-16`; `ContactMessage.js:3-52`). |
| Careers — listings | `Careers.jsx` calls `jobService.getJobs` through `useApiResource` → `GET /api/jobs` → `getJobs` → `Job.find` → MongoDB. Department filters are applied client-side (`Careers.jsx:60-64,152-164`; `jobService.js:3-7`; `jobRoutes.js:15-22`; `jobController.js:18-57`; `Job.js:3-82`). |
| Careers — application | The application form sends first/last name, email, optional phone/message, a CV URL and optional job ID → `applicationService.createApplication` → `POST /api/applications` → controller validates an optional job ID and active job, then creates an `Application`. The create response intentionally omits `cv` (`Careers.jsx:23-47,87-105`; `applicationService.js:3-6`; `applicationRoutes.js:14-20`; `applicationController.js:15-48`; `Application.js:3-57`). Admin list/detail/update also exclude `cv`; see F-03. |
| Services | Home and Services request `serviceService.getServices` → `GET /api/services` → `getServices` → `Service.find`. Service details request by slug → `GET /api/services/:slug` → `getServiceBySlug` → `Service.findOne`. `Services.jsx` is a distinct component and uses `hero-2.mp4` (`Home.jsx:18-24`; `Services.jsx:15-27`; `ServiceDetails.jsx:1-29`; `serviceService.js:3-7`; `serviceRoutes.js:15-22`; `serviceController.js:19-49`; `Service.js:3-94`). |
| Portfolio and quote calculator | `Portfolio.jsx` loads projects and services independently via `projectService` and `serviceService` → `GET /api/projects` and `GET /api/services` → respective controllers → `Project.find` and `Service.find`. The calculator filters priced services and computes/prints a quote in the browser; it does **not** save a quote or call a quote API (`Portfolio.jsx:84-105,195-209`; `projectService.js:3-7`; `projectRoutes.js:15-22`; `projectController.js:18-49`; `Project.js:3-118`). |
| Login/register/me | `AuthPage.jsx` → `authService` → `POST /api/auth/login` or `/api/auth/register` → `authController` → `User`. Login returns a JWT and safe user data. On refresh, `AuthContext` reads the token from localStorage and calls `GET /api/auth/me`; auth middleware verifies the token and fetches the user record (`AuthPage.jsx:1-57`; `authService.js:3-23`; `authRoutes.js:11-24`; `authController.js:26-110`; `authMiddleware.js:14-49`; `User.js:3-41`; `AuthContext.jsx:21-53`). |

All API resource wrappers use the shared fetch/error/token layer. Collection wrappers default to `limit: 100`, while the API supports `page`/`limit` and caps limit at 100 (`client/src/services/*Service.js`; `server/utils/apiQuery.js:1-12`). Current public UI does not expose a continuation/pagination control for those resources (F-11).

### 4. Authentication and authorization

- Registration validates the request and password, hashes passwords with bcrypt at 12 rounds, and hardcodes the new role as `user` (`server/controllers/authController.js:26-64`; `server/config/env.js:19-27`).
- Passwords must be at least 12 characters and no more than 72 UTF-8 bytes (`server/utils/passwordPolicy.js:1-14`). The user schema excludes the password from normal queries (`server/models/User.js:19-30`).
- JWTs are signed with HS256 and configured expiry; the environment validator requires a JWT secret of at least 32 characters and defaults expiry to `15m` (`server/utils/jwt.js:4-13`; `server/config/env.js:3-17`).
- Authentication middleware accepts a bearer token, verifies it, validates the embedded user ID, reloads the user and sets current role data on the request (`server/middleware/authMiddleware.js:14-49`). Admin authorization checks the current database role (`server/middleware/adminMiddleware.js:1-17`).
- Login and registration are limited to 10 requests per 15 minutes per default rate-limit store (`server/routes/authRoutes.js:10-24`).
- The client stores the bearer token under `zayer_auth_token` in `localStorage`; logout removes it locally. There is no server-side logout/revocation endpoint in the wired auth API (`client/src/services/api.js:1,17-20,75-81`; `AuthContext.jsx:11-13,56-58`; `server/routes/authRoutes.js:22-24`).

### 5. Mongoose models

Every model enables timestamps and `strict: 'throw'`. The schema ranges below include fields, validation and indexes.

| Model | Fields and validation | Indexes / references |
|---|---|---|
| `User` | name, email (lowercased, validated), password (select false), role (`user`/`admin`), avatar (`User.js:3-39`) | Unique email; role + created date (`User.js:11-41`). |
| `Service` | title, slug, shortDescription, description, icon, image, category, price, currency, features, technologies, isActive; typed limits/enums/defaults (`Service.js:3-92`) | Unique slug; isActive + category + created date (`Service.js:11-94`). |
| `Project` | title, slug, description, category, image, mediaUrl/mediaType, portfolioSection, sector, linkUrl, gallery, technologies, client, year, featured, isPublished; validation requires an image or media URL (`Project.js:3-115`) | Unique slug; published/featured/created compound index; text index on title/description/client (`Project.js:11-118`). |
| `Job` | title, slug, department, location, type, experience, description, requirements, responsibilities, isActive (`Job.js:3-80`) | Unique slug; isActive + department + created date (`Job.js:11-82`). |
| `Application` | optional `job` ObjectId ref, firstName, lastName, email, phone, `cv` URL string, message, status (`Application.js:3-57`) | job/status/created indexes and email index (`Application.js:4-7,59-60`). |
| `ContactMessage` | name, email, phone, company, subject, message, status (`ContactMessage.js:3-52`) | Email index; status + created date (`ContactMessage.js:11-17,54`). |

The schemas use validation and explicit enums; controllers generally use field allowlists, query parsing and `runValidators` on updates. The application’s `job` reference is optional. Job deletion checks whether applications reference the job (`Job.js`, `server/controllers/jobController.js:87-112`); there is no database-level foreign key or cascade.

### 6. Translations and page metadata

English and French dictionaries are in `client/src/translations/en.js` and `fr.js`. `LanguageContext` loads only `en` or `fr` from `zayer-digital-language`, updates `<html lang>`, and falls back to English (`LanguageContext.jsx:8-27`). `PageMeta` updates `document.title` and the shared description meta tag in a React effect and de-duplicates the ZAYER suffix (`PageMeta.jsx:3-23`). Thus metadata is client-rendered, not pre-rendered in the server HTML; see F-15.

### 7. Environment and local setup

Variable **names only**:

- Required server variables: `MONGO_URI`, `JWT_SECRET` (at least 32 characters).
- Optional/defaulted server variables: `NODE_ENV` (defaults to `development`), `PORT` (defaults to 5000), `JWT_EXPIRES_IN` (defaults to `15m`), `CLIENT_URL` (defaults to `http://localhost:5173`; accepts comma-separated origins).
- Admin seed variables: `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Client variable: `VITE_API_URL`.

`README.md` asks for Node.js 20+ and npm 10+, then `npm install`, server/client environment files, and local MongoDB or a connection URI (`README.md:5-22`). Because Git ignores `.env.*`, the example templates are not in the tracked file list. In a clone, create `server/.env` and `client/.env` manually with the variable names above and select a disposable/local MongoDB database. The example client API port is 5099; set `PORT=5099` and matching `CLIENT_URL` if using those defaults (`client/.env.example:1`; `server/.env.example:1-9`).

Root commands: `npm run client`, `npm run server`, `npm run dev`, `npm run build`. The root does not define `test`; server tests are invoked with `npm test --workspace zayer-digital-server`. The seed and official-service sync scripts write to MongoDB and should only be used intentionally with the intended database (`package.json:10-21`; `server/package.json:6-24`; `README.md:24-29,45-51`). Neither seed nor sync was run.

Main dependencies: React/React DOM render the client; React Router provides client routes; Lucide React supplies icons; Vite builds/serves the client; Express handles HTTP routes; Mongoose maps MongoDB documents; `jsonwebtoken` handles JWT; `bcryptjs` hashes passwords; `cors` controls cross-origin access; `express-rate-limit` limits auth attempts; `dotenv` loads server environment; `concurrently` starts both workspaces (`client/package.json:11-20`; `server/package.json:13-24`; root `package.json:16-20`). No dependency vulnerability scan was run.

## Part 2 — Audit findings

### A–C. Security, backend and database

**F-01 — HIGH — Error response can disclose stack traces.** The error middleware includes stack output whenever `NODE_ENV` is anything other than the literal `production`; when unset, the environment config’s development default is not copied back into `process.env`, so the handler still exposes a stack. An incorrectly configured deployment can disclose filesystem paths and implementation details. Use the validated `env.nodeEnv` consistently and return generic 500 responses outside explicitly safe local/test modes. Evidence: `server/middleware/errorMiddleware.js:6-40`; `server/config/env.js:19-34`.

**F-03 — MEDIUM — Submitted CV link cannot be retrieved by an admin API.** Application creation stores the CV URL, but create, list, detail and update responses all omit `cv`. Even a future admin UI cannot retrieve an applicant’s CV through the current API. Provide a narrowly scoped, authenticated/admin-only retrieval path and decide access/retention with the owner; do not expose the value publicly. Evidence: `server/controllers/applicationController.js:15-48,50-112`; `Application.js:35-52`.

**F-04 — MEDIUM — Public submission endpoints have no rate limit.** Auth has a limiter; public contact and application POST routes do not. Automated submissions can fill the database, trigger notification/operations costs if added later, and burden staff. Add appropriate, shared limits and abuse controls without blocking legitimate applicants. Evidence: `server/routes/authRoutes.js:11-24`; `server/routes/contactRoutes.js:14-20`; `server/routes/applicationRoutes.js:14-20`.

**F-05 — MEDIUM — No security-header middleware is configured.** Express disables its identifying header and configures CORS/body limits, but no Helmet/security-header middleware is installed or registered. A deployment-level policy may supply some headers, but that was not verified. Define and verify headers such as CSP and frame/content-type/referrer protections at the application or hosting layer. Evidence: `server/server.js:1-48`; `server/package.json:13-24`.

**F-06 — MEDIUM — Admin user management permits self/last-admin removal.** Admins can update a user’s role and delete any user, including themselves or the last admin. A valid admin can therefore lock the team out accidentally or by misuse. Add safeguards for self-demotion/deletion and preservation of at least one active administrator. Evidence: `server/controllers/userController.js:52-71`.

**F-09 — MEDIUM — Auth throttling uses the default per-process store.** The rate limit is configured only in the auth router and provides no shared store configuration. In a multi-process/multi-instance deployment each process may enforce a separate counter; deployments behind proxies also need correct trusted-proxy configuration. Use a shared store and verify proxy/IP behavior in the intended deployment. Evidence: `server/routes/authRoutes.js:10-20`; `server/server.js:19-24`.

**F-18 — MEDIUM — Auth integration tests drop a database.** The test rewrites the database name to a PID-suffixed test name, connects using `MONGO_TEST_URI` (or localhost), and calls `dropDatabase()` during setup and teardown. It is deliberately destructive to that test database and must not be run with a URI whose host/permissions are not explicitly disposable. This test was not run. Require an isolated test MongoDB and keep test credentials/permissions separate from development/production. Evidence: `server/test/auth.test.js:8-19,34-58`.

**Backend strengths observed:** current-user data is reloaded from MongoDB after JWT verification, admin role is checked server-side, public registration hardcodes a normal-user role, passwords are hashed, user password fields are excluded from standard queries, list parameters are parsed/capped, update bodies use allowlists, and ID routes validate ObjectIds (`authController.js:26-64`; `authMiddleware.js:14-49`; `adminMiddleware.js:1-17`; `apiQuery.js:1-12,100-123`; `validationMiddleware.js:3-12`). No obvious unauthenticated admin route or direct NoSQL query-operator injection path was found in the reviewed controllers. This is not a penetration-test guarantee.

The search parser escapes regex metacharacters; no `dangerouslySetInnerHTML` usage was found in the reviewed client; and dynamic values in the quote-print HTML are escaped before interpolation (`server/utils/apiQuery.js:20-35`; `client/src/pages/public/Portfolio.jsx:34-55,68-72`). This reduces the obvious injection surface but does not replace a broader XSS/security test.

### D–G. Frontend, accessibility, performance, SEO and i18n

**F-07 — MEDIUM — No administration interface or notification workflow is routed in the client.** The application has public `/login` and `/register`, and backend management endpoints, but `App.jsx` routes no protected/admin page. `ProtectedRoute`/`AdminRoute` are described as reusable guards, not currently wired screens. Contact and application submissions are persisted through the API; no email/notification service was found, and staff cannot view/process submissions through this client. If an admin UI or notification workflow is in scope, build it as a separately guarded surface; otherwise document the API-only operational workflow. Evidence: `client/src/App.jsx:20-34`; `README.md:30-33,61-71`; `server/controllers/contactController.js:13-16`; `applicationController.js:15-48`; `server/package.json:13-24`.

**F-08 — MEDIUM — Environment templates are excluded from Git.** `.gitignore` ignores `.env.*`, which includes both `client/.env.example` and `server/.env.example`; `git check-ignore` confirmed both are ignored. A fresh clone therefore lacks the setup templates referenced by the README. Add explicit allow rules for example files while continuing to ignore actual secret-bearing environment files. Evidence: `.gitignore:1-5`; `README.md:14-18`; `client/.env.example:1`; `server/.env.example:1-9`.

**F-10 — MEDIUM — Gold text on light surfaces may fail WCAG contrast.** The brand gold is `#c8a96e`; its contrast against white is approximately 2.24:1, below 4.5:1 for normal text. The stylesheet applies gold as text in multiple components, including compact editorial/service labels; decorative icons and text on navy are different cases. Audit every rendered foreground/background pair and adjust text colors where necessary. No automated page-wide contrast scan was run. Evidence: `client/src/index.css:10,86,123,647,674`.

**F-11 — LOW — Collection views request only the first 100 records.** Service, project and job service wrappers default to `limit: 100`; the backend caps each request at 100 and supports pages, but the public UI filters those fetched records client-side and has no paging/continuation control. Content beyond the first page is invisible once a collection exceeds 100 records. Add pagination/infinite loading or establish and enforce a smaller content cap. Evidence: `client/src/services/serviceService.js:3-7`; `projectService.js:3-7`; `jobService.js:3-7`; `server/utils/apiQuery.js:1-12`; `Careers.jsx:60-64`; `Portfolio.jsx:90-103`.

**F-12 — LOW — Some UI/API error strings remain English in French mode.** Shared API errors are plain English strings and `ApiStates` renders “Try again”; these are not sourced from the translation dictionaries. French users can therefore see mixed-language errors/retry controls. Route user-visible shared messages through the translation layer or return stable error codes for localized rendering. Evidence: `client/src/services/api.js:11-40`; `client/src/components/common/ApiStates.jsx:1-14`.

**F-20 — MEDIUM — Database-managed content has no general EN/FR content model.** The service, project and job schemas store one set of text fields. The client has an official-service language mapping, but arbitrary database-managed project/job content and non-canonical service text have no locale field or translation workflow. Visitors switching languages may see the same source-language content. Add an owner-approved localization strategy for managed content and define fallback behavior. Evidence: `server/models/Service.js:3-92`; `Project.js:3-115`; `Job.js:3-80`; `client/src/data/officialServices.js:1-31`.

**F-13 — LOW — Resource hook does not cancel or order overlapping requests.** `useApiResource` calls the loader without an abort signal or request sequence guard. A slow earlier request can complete after a reload/new dependency request and replace fresher data; route unmounts also do not abort network work. Add cancellation or stale-response protection if loaders can overlap. Evidence: `client/src/hooks/useApiResource.js:3-23`.

**F-22 — LOW — Any `/me` failure clears the saved login.** `AuthContext` clears the token and user for every rejected `getMe()` request, including a temporary network/server failure, not only an expired/invalid-token response. A short outage can therefore force a valid user to sign in again. Preserve credentials on transient failures and clear them only for an authentication-invalid response; provide a retry/error state. Evidence: `client/src/context/AuthContext.jsx:21-35`.

**F-14 — LOW — Candidate orphaned data/components remain in the client.** A source search found no references beyond their own declarations for `data/jobs.js`, `data/projects.js`, `data/services.js`, `components/cards/JobCard.jsx`, `ProjectCard.jsx`, `ServiceCard.jsx`, and `components/sections/ProcessStep.jsx`. They appear unused after migration to API data and current page-specific components; verify with a project-wide import/build analysis before removal. Evidence: those files’ declarations at line 1 and no in-client import/use matches in the search.

**F-21 — MEDIUM — Bearer token is exposed to any successful same-origin script injection.** The JWT is stored in `localStorage` and attached to API requests. No direct XSS sink was identified in the reviewed page code, but any future/current script injection or compromised dependency executing in the origin could read and exfiltrate the token. Prefer a carefully designed HttpOnly-cookie approach if compatible with the deployment, or retain bearer storage only with strong XSS prevention/CSP and short token lifetime. Evidence: `client/src/services/api.js:1,17-20,43-57`; `client/src/context/AuthContext.jsx:21-25,39-48`.

**F-15 — LOW — SEO metadata is incomplete and client-rendered.** The HTML shell has a static title and description. `PageMeta` changes title and description after React runs, but there is no canonical/OG/Twitter metadata in the shell and no sitemap/robots asset was found in the reviewed app tree. Crawlers relying on initial HTML may see generic metadata, and social shares have no page-specific preview. Add route-aware prerendering or equivalent metadata delivery, canonical policy and social tags; provide robots/sitemap only when deployment URLs are confirmed. Evidence: `client/index.html:1-11`; `client/src/components/common/PageMeta.jsx:3-23`.

**F-16 — LOW — Hero video has no poster and has not been checked under constrained networks.** Both source MP4s exist: `hero-1.mp4` is approximately 3.72 MB and `hero-2.mp4` approximately 5.50 MB. Home sets `preload="none"` and Services sets `preload="metadata"`; neither JSX video declares a poster. CSS fallback/overlay exists, but first-frame appearance, download behavior, mobile autoplay and slow-network transitions were not verified. Add/verify optimized poster assets and test actual network conditions. Evidence: `client/src/components/sections/Hero.jsx:22-23`; `client/src/pages/public/Services.jsx:26`; files under `client/public/videos/`.

**F-17 — LOW — Client has no test script or discovered UI test suite.** The client package defines dev/build/preview only, and the root package defines no `test` script. The build catches bundling errors but does not verify routes, forms, translations, focus, visual breakpoints or API failures. Add focused component/route tests and a safe browser smoke suite when test infrastructure is approved. Evidence: `package.json:10-15`; `client/package.json:6-20`.

**Accessibility observations:** Forms use associated label wrappers and native input constraints; the dialogs use `role="dialog"`, `aria-modal`, keyboard handling and the shared focus-trap hook. Hero background video is hidden from assistive technology (`Contact.jsx:99-122`; `Careers.jsx:29-47,194-195`; `PortfolioLightbox.jsx`; `useFocusTrap.js`; `Hero.jsx:22-23`). No screen-reader/keyboard end-to-end audit was performed. The gold/light contrast risk is F-10. Other WCAG 2.1 AA conformance is **not verified**.

**Design-system observations:** The CSS variables match the supplied target navy/gold/neutral palette, and DM Sans/Playfair Display are both referenced by CSS and loaded in the HTML shell (`client/src/index.css:1-15,20-26`; `client/index.html:9-11`). No palette-token mismatch was found in these core values.

**Performance observations:** the generated JavaScript and CSS bundle are modest at the recorded gzip sizes; project media cards lazy-load image assets (`PortfolioMediaCard.jsx:45-48`). Hero videos add several megabytes outside the bundle and need real device/network checks (F-16). No runtime profiling, Core Web Vitals, image CDN, repeat-request or cache test was performed. `useApiResource` may issue out-of-order requests (F-13).

### H–I. Tests, operations, content and legal readiness

**F-02 — HIGH — Privacy notice still contains owner-confirmation placeholders.** The notice is correctly localized and identifies legal entity, retention/deletion, access providers and applicable rights/process as `[TO CONFIRM]`. The explanatory reminder is development-only, so production can show unresolved placeholders without the reminder. Do not publish the notice as complete until the owner supplies and approves those facts and the actual operating practices match them. No legal conclusion is made here. Evidence: `client/src/translations/en.js:84-119`; `client/src/translations/fr.js:92-127`; `client/src/pages/public/PrivacyPolicy.jsx:8-36`.

The notice describes contact form data, application data and a CV link rather than an uploaded file. The owner must confirm the actual legal entity, purposes, retention/deletion, authorized persons/providers, rights and request process in both languages before production. The applicant CV is a URL field in the model and is currently omitted from all application API responses (F-03). Evidence: `Application.js:35-52`; `README.md:36-43`.

The supplied official Business Profile PDF and legacy HTML/PHP inputs were not found in the repository, so the required comparison of positioning, claims, contact details, sections, forms, media and bilingual behavior is **not verified**. Do not infer a discrepancy or “correct” fact from the website alone. No database was inspected, so the live content inventory and its consistency with UI expectations are also **not verified**.

## Page-by-page public application check

All listed routes resolve to distinct React components in the route table. Component wiring and source-level API usage were verified; live HTTP results, browser visuals, 390/768/1024/1440 px layouts, and empty/error behavior against a running API were not verified.

| Route | Component and source-level behavior | Verification result |
|---|---|---|
| `/` | `Home`; `hero-1.mp4`; calls services API; localized page title/description and shared public layout. | Route/component/video reference verified in source; video load and real API state not browser-tested. |
| `/about` | `About`; localized title/content; shared layout. | Route/component verified; viewport/accessibility rendering not browser-tested. |
| `/services` | Dedicated `Services` component, not Home; `hero-2.mp4`; service API and loading/error/empty states. | Dedicated route and video source verified (`App.jsx:24`; `Services.jsx:15-27`); actual playback/API not browser-tested. |
| `/services/:slug` | `ServiceDetails`; fetches a service by slug; handles missing service in the component. | Route/component verified; API/not-found runtime not tested. |
| `/portfolio` | `Portfolio`; project/service APIs; section/category filters, media cards/lightbox and client-side quote calculation/print. | Source flow verified; no quote is persisted; runtime media/print/API states not tested. |
| `/careers` | `Careers`; jobs API, department filters, application dialog and CV URL submission. | Source flow verified; no binary upload; no application was submitted. |
| `/contact` | `Contact`; submits to contact API and links the privacy notice; displays success/error state. | Source flow verified; no real submission was made. |
| `/privacy` | `PrivacyPolicy`; EN/FR data-driven policy content and contact mailto. | Route/component and placeholders verified; owner/legal review remains outstanding (F-02). |

`/login` and `/register` also render `AuthPage`; `*` renders `NotFound`. There are no dashboard routes (`client/src/App.jsx:29-34`).

## API ↔ frontend flow map

| Frontend page/action | Client service / request | API route | Controller → model |
|---|---|---|---|
| Contact submit | `contactService.createContact` | `POST /api/contact` | `createContactMessage` → `ContactMessage` |
| Contact inbox (API only) | `contactService.getContacts/getContactById/updateContact` | `GET /api/contact`, `GET/PUT /api/contact/:id` | contact controller → `ContactMessage` (admin routes) |
| Careers jobs | `jobService.getJobs/getJobBySlug` | `GET /api/jobs`, `GET /api/jobs/:slug` | job controller → `Job` |
| Careers application | `applicationService.createApplication` | `POST /api/applications` | `createApplication` → optional `Job` lookup + `Application` |
| Applications inbox (API only) | `applicationService.getApplications/getApplicationById/updateApplication` | `GET /api/applications`, `GET/PUT /api/applications/:id` | application controller → `Application` |
| Home/Services | `serviceService.getServices` | `GET /api/services` | `getServices` → `Service` |
| Service detail | `serviceService.getServiceBySlug` | `GET /api/services/:slug` | `getServiceBySlug` → `Service` |
| Portfolio | `projectService.getProjects`, `serviceService.getServices` | `GET /api/projects`, `GET /api/services` | project/service controllers → `Project`, `Service` |
| Login/register/me | `authService` | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` | auth controller → `User` |
| Admin content/users (API only) | `serviceService`, `projectService`, `jobService`, `userService` create/update/delete methods | guarded POST/PUT/DELETE and user routes | respective controller → respective model |

Endpoint registration is in `server/server.js:39-45`; route authorization and controller methods are in each corresponding `server/routes/*Routes.js` and `server/controllers/*Controller.js`. The quote calculator is intentionally client-only; no quote endpoint/model exists.

## Legacy and official-profile comparison

**Not verified.** No named legacy source files (`index (1).html`, `about.html`, `careers.html`, `contact.html`, `index.php`) or official profile PDF were available under the reviewed repository. The README confirms some migrated page/content and workflow choices—such as database-backed public content, a CV URL rather than a file upload, and supplied hero videos—but it is not a substitute for comparing the actual original sources (`README.md:34-43`). The six-service official profile content cannot be independently checked against the PDF in this audit.

## Part 3 — Prioritized action plan

### 1. Complete findings register

| ID | Severity | Area | File(s) | Short fix / action | Effort |
|---|---|---|---|---|---|
| F-01 | HIGH | Security/errors | `server/middleware/errorMiddleware.js:6-40`; `server/config/env.js:19-34` | Use validated environment mode; do not return stack traces to clients outside local development. | S |
| F-02 | HIGH | Legal/content | `client/src/translations/en.js:84-119`; `fr.js:92-127`; `PrivacyPolicy.jsx:8-36` | Obtain owner-approved entity/access/retention/rights facts; replace all placeholders in both languages before publishing. | M |
| F-03 | MEDIUM | API/privacy/workflow | `server/controllers/applicationController.js:15-112`; `server/models/Application.js:35-52` | Provide least-privilege admin-only CV link access or remove collection if not required; establish retention policy. | M |
| F-04 | MEDIUM | Abuse prevention | `server/routes/contactRoutes.js:14-20`; `applicationRoutes.js:14-20` | Add appropriate limits/abuse defenses to public submission endpoints. | M |
| F-05 | MEDIUM | Security headers | `server/server.js:1-48`; `server/package.json:13-24` | Define and verify application/host security headers and a compatible CSP. | M |
| F-06 | MEDIUM | Authorization operations | `server/controllers/userController.js:52-71` | Prevent accidental self/last-admin demotion or deletion. | S |
| F-07 | MEDIUM | Product/admin UX | `client/src/App.jsx:20-34`; `README.md:30-33,61-71` | Decide API-only versus dashboard scope; if needed, add protected admin workflows for content and submissions. | L |
| F-08 | MEDIUM | Developer experience/DevOps | `.gitignore:1-5`; `client/.env.example:1`; `server/.env.example:1-9` | Allowlist example env templates while continuing to ignore real `.env` secrets. | S |
| F-09 | MEDIUM | Auth resilience | `server/routes/authRoutes.js:10-20`; `server/server.js:19-24` | Configure a shared rate-limit store and verify deployment proxy/IP handling. | M |
| F-10 | MEDIUM | Accessibility/visual | `client/src/index.css:10,86,123,647,674` | Measure rendered foreground/background pairs and replace gold for text where contrast is insufficient. | M |
| F-11 | LOW | Frontend/data scale | `client/src/services/serviceService.js:3-7`; `projectService.js:3-7`; `jobService.js:3-7`; `server/utils/apiQuery.js:1-12` | Expose paging/continuation or set an enforced product content cap. | M |
| F-12 | LOW | i18n/errors | `client/src/services/api.js:11-40`; `client/src/components/common/ApiStates.jsx:1-14` | Localize shared messages and retry labels. | S |
| F-13 | LOW | Frontend async lifecycle | `client/src/hooks/useApiResource.js:3-23` | Abort or ignore stale overlapping fetches. | S |
| F-14 | LOW | Maintainability | `client/src/data/jobs.js`; `data/projects.js`; `data/services.js`; `components/cards/JobCard.jsx`, `ProjectCard.jsx`, `ServiceCard.jsx`; `components/sections/ProcessStep.jsx` | Confirm orphan status with import analysis and remove only confirmed dead code. | S |
| F-15 | LOW | SEO | `client/index.html:1-11`; `client/src/components/common/PageMeta.jsx:3-23` | Deliver route metadata to crawlers and add canonical/social metadata and crawl files where appropriate. | M |
| F-16 | LOW | Media/performance | `client/src/components/sections/Hero.jsx:22-23`; `client/src/pages/public/Services.jsx:26`; `client/public/videos/` | Add/test suitable poster and optimized video delivery on mobile/slow networks. | M |
| F-17 | LOW | Testing | `package.json:10-15`; `client/package.json:6-20` | Add a client test script and route/form/accessibility smoke coverage. | M |
| F-18 | MEDIUM | Test safety | `server/test/auth.test.js:8-19,34-58` | Keep tests restricted to isolated disposable MongoDB credentials; preserve the PID-specific test database boundary. | S |
| F-19 | INFO | Audit evidence | External legacy files and official profile PDF unavailable | Supply the official PDF and legacy inputs for source-to-source content comparison. | S |
| F-20 | MEDIUM | i18n/content | `server/models/Service.js:3-92`; `Project.js:3-115`; `Job.js:3-80`; `client/src/data/officialServices.js:1-31` | Define localization fields/workflow and a clear fallback for admin-managed text. | M |
| F-21 | MEDIUM | Authentication/token storage | `client/src/services/api.js:1,17-20,43-57`; `client/src/context/AuthContext.jsx:21-25,39-48` | Reduce script-accessible token exposure; assess HttpOnly cookie auth or strengthen XSS/CSP controls. | M |
| F-22 | LOW | Auth state/error handling | `client/src/context/AuthContext.jsx:21-35` | Clear stored credentials only for invalid/expired-token responses; surface transient `/me` failures and allow retry. | S |

### 2. Recommended order

**P0 — Blockers before production**

1. F-01: stop possible stack disclosure.
2. F-02: obtain and publish accurate privacy details; do not ship unresolved legal placeholders.
3. Confirm which database and environment variables a production deployment uses; run no seeds/tests against it.

**P1 — High priority**

1. Frontend: F-07, decide and implement/administer the actual staff workflow if a dashboard is required.
2. Frontend: F-10, verify and correct WCAG contrast for rendered UI states.
3. Frontend/content: F-20, decide how database-managed public content will be localized.
4. Backend: F-03, establish controlled applicant CV access and retention.
5. Backend: F-04/F-09, implement and deploy effective submission/auth abuse controls.
6. Backend: F-06, preserve at least one admin account.
7. DevOps: F-08, ensure clean clones have safe, tracked setup templates.

**P2 — Medium**

1. Frontend: F-11 pagination, F-12 French error strings, F-13 request lifecycle.
2. Frontend: F-15 route metadata, F-16 video poster/encoding and network checks.
3. Backend/security: F-05 headers and deployment verification.
4. Testing: F-17 client coverage; keep the destructive test boundary F-18 explicit.
5. Owner: provide the official/legacy source files and confirm content against them (F-19).

**P3 — Low**

1. F-14 confirm and remove only dead data/components.
2. Run documented runtime/device/accessibility checks and dependency audit in an approved non-production environment.

### 3. Ready-to-paste prompts for the top 10 tasks

Each prompt below is deliberately scoped to the named files. For F-02, provide the owner-approved legal facts before asking for edits; do not ask an implementer to invent them.

1. **F-01 — Stack disclosure**  
   “Fix the production error-response stack disclosure. Work only in `server/middleware/errorMiddleware.js` and `server/config/env.js`. Use the validated environment mode consistently, keep detailed errors in server logs, and return a generic 500 response to clients outside local development. Add or update focused tests only if I explicitly approve test-file changes. Do not run server tests or connect to MongoDB.”

2. **F-02 — Privacy notice**  
   “Using these owner-approved facts: [paste legal entity, retention/deletion rules, authorized people/providers, user rights and request process], replace all `[TO CONFIRM]` text in `client/src/translations/en.js` and `client/src/translations/fr.js` with accurate localized wording. Review `client/src/pages/public/PrivacyPolicy.jsx` so the notice does not claim unsupported practices. Do not invent terms or change unrelated translations.”

3. **F-07 — Administration workflow decision/implementation**  
   “Add a small, protected admin area for managing [specify approved resources]. Limit changes to `client/src/App.jsx`, the existing route guard components, and the specifically named new admin page/components. Enforce access in the API as well as the UI; do not expose protected data or call mutation endpoints without admin authorization. Do not touch database data.”

4. **F-03 — CV access**  
   “Implement a least-privilege way for authorized admins to retrieve the CV URL submitted with an application. Limit changes to `server/controllers/applicationController.js`, `server/routes/applicationRoutes.js`, and the explicitly named client service/UI files needed for the approved admin workflow. Keep CV data out of public/create responses and do not add file uploads or change retention policy without owner direction.”

5. **F-04 — Public form abuse control**  
   “Add rate limiting/abuse controls to public contact and career-application submissions. Restrict changes to `server/routes/contactRoutes.js`, `server/routes/applicationRoutes.js`, and one shared limiter middleware/config file if required. Preserve ordinary validation/status behavior, return a clear 429 response, and do not run server tests or connect to a database.”

6. **F-06 — Protect admin access**  
   “Prevent an administrator from accidentally removing their own access or deleting/demoting the last active admin. Change only `server/controllers/userController.js` and add focused tests only with prior approval. Return a clear conflict/validation response; do not change role authorization semantics elsewhere.”

7. **F-05 — Security headers**  
   “Define a production-appropriate security-header policy for this Express app. Limit changes to `server/server.js`, `server/package.json`, and the lockfile only if a new header package is necessary. Preserve current CORS and API behavior, document CSP decisions, and do not install dependencies or run the server unless I approve.”

8. **F-08 — Environment examples**  
   “Make the example environment templates available in a clean Git clone without tracking real credentials. Change only `.gitignore`, `client/.env.example`, and `server/.env.example`. Keep actual `.env` files ignored, use placeholders only, and verify tracked/untracked status without printing secret values.”

9. **F-10 — Contrast remediation**  
   “Audit the rendered text color/background pairs for WCAG 2.1 AA contrast and adjust only the necessary CSS rules in `client/src/index.css`. Preserve the official gold for decorative accents and dark backgrounds where it passes. Report the measured ratios and affected selectors; do not change the brand palette variables without approval.”

10. **F-11 — Client pagination**  
    “Add a user-visible way to reach later pages of service, project and job results using the API’s existing `page`/`limit` contract. Limit changes to `client/src/services/serviceService.js`, `projectService.js`, `jobService.js`, and the specific public page components `Home.jsx`, `Portfolio.jsx`, `Careers.jsx`, and `Services.jsx` as needed. Preserve loading/error/empty states and filters; do not change server behavior or database data.”

### 4. Scorecard and production decision

| Area | Score / 10 | Reason |
|---|---:|---|
| Frontend | 7 | Clear page/service/context boundaries and successful build; no client automated tests and resource paging/lifecycle gaps. |
| Backend | 7 | Controllers, models, validators and API response patterns are structured; public abuse controls and CV admin workflow need work. |
| Security | 5 | Good JWT/password/role fundamentals, offset by conditional stack disclosure, missing header policy, localStorage token exposure and public form throttling gaps. |
| Database | 7 | Six explicit schemas, timestamps, enums and useful indexes; live data was not inspected and retention/CV process is unresolved. |
| UI/UX | 7 | Distinct public pages, responsive CSS, media, loading/error/empty states and EN/FR content; browser behavior and legal placeholders need review. |
| Responsive | 6 | Responsive styles exist, but requested device widths were not exercised in a browser for this audit. |
| Performance | 7 | Build bundle is moderate and portfolio images lazy-load; video weight/network behavior and runtime metrics remain unverified. |
| SEO | 4 | Route titles/descriptions update client-side; initial HTML is generic and no canonical/social/crawl artifacts were found. |
| Testing | 3 | Server tests exist but were intentionally not run; no client test script/suite was found. |
| Architecture | 7 | Workspaces separate React and Express, with reusable service/controller/model layers; no admin client workflow and candidate orphan files remain. |
| **Overall** | **6** | A credible application foundation, but not production-ready until security configuration and privacy facts are resolved and operations are tested safely. |

**Production status: NOT READY.** The highest blockers are conditional stack disclosure, unresolved privacy/legal details, exposed browser token storage in the event of script injection, no end-to-end operational path for application CV/admin work, and the absence of safe runtime/device verification. The successful client build verifies compilation only; it does not establish API or production readiness.
