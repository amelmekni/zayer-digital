# ZAYER Digital — Technical Audit

**Audit date:** 2026-10-17  
**Repository revision inspected:** `182054f` on `main`  
**Worktree at start:** clean  
**Scope:** tracked React/Express/Mongoose code, tests, package manifests and deployment documentation. No `.env` files were read, no production service was called, and no database was contacted.

## Executive summary

The repository is a React 18/Vite frontend and Express 4/Mongoose 8 API in a single npm-workspaces repository. The public site, authentication, catalog, career/contact intake and sales workflows are implemented. Server-side quote calculation, role checks, transactional status changes and keyed payment replay are present. Production behavior, database contents, external deployment settings and real email/CV hosting remain unverified.

| Area | Status | Evidence |
|---|---|---|
| Frontend production bundle | PASS | `npm run build` |
| Safe unit tests | PASS | Exact command and counts in the final audit status below |
| Backend syntax | PASS | `node --check` for tracked server `.js` files |
| Postman execution | NOT TESTED | No isolated API/database environment was provided |
| MongoDB integration | BLOCKED | Suites require explicitly opted-in, local, disposable replica sets; none was used |
| Browser/API workflows | BLOCKED | Running the app without a verified local `VITE_API_URL`/`MONGO_URI` risks calling a non-local service |
| Production readiness | BLOCKED | Production deployment, database, proxy, credentials, catalog and browser runtime were not accessed |

The latest committed code includes the missing `useEffect` React import fix in `client/src/context/LanguageContext.jsx`. The earlier blank-page defect is therefore absent from the inspected `HEAD`.

## Application inventory

### Frontend pages and navigation

All page routes are in `client/src/App.jsx`; `PublicLayout` supplies shared navigation/footer. There is no separate privacy-policy route/page in the React router.

| Page / route | Implementation | API calls / data | Access | Verification |
|---|---|---|---|---|
| Home `/` | `client/src/pages/public/Home.jsx`, shared sections/cards | Active services, published projects, job listings through service modules | Public | Build/static source inspection; live data NOT TESTED |
| About `/about` | `client/src/pages/public/About.jsx` | Static localized content | Public | Build/static source inspection |
| Services `/services` | `client/src/pages/public/Services.jsx` | `GET /api/services` | Public | Build/static source inspection |
| Service details `/services/:slug` | `client/src/pages/public/ServiceDetails.jsx` | `GET /api/services/:slug` | Public | Build/static source inspection |
| Portfolio `/portfolio` | `client/src/pages/public/Portfolio.jsx` | Projects, active services, public quote-request endpoints | Public | Targeted unit tests/build; live API NOT TESTED |
| Careers `/careers` | `client/src/pages/public/Careers.jsx` | `GET /api/jobs`, `POST /api/applications` | Public | Static inspection; live submission NOT TESTED |
| Contact `/contact` | `client/src/pages/public/Contact.jsx` | `POST /api/contact` | Public | Static inspection; persistence NOT TESTED |
| Login `/login`, registration `/register` | `client/src/pages/public/AuthPage.jsx` | `/api/auth/login`, `/api/auth/register`, `/api/auth/me` and logout | Public entry; endpoints enforce their own rules | Unit auth/context checks; DB integration NOT TESTED |
| Sales workspace `/dashboard` | `client/src/pages/public/SalesDashboard.jsx` | Dashboard, quotes, payments, collections, agents | Authenticated; API additionally requires admin or sales-agent role | Middleware/domain unit tests; database workflow NOT TESTED |
| Not found `*` | `client/src/pages/public/NotFound.jsx` | None | Public | Build/static inspection |

Common React hooks are imported at their call sites, including `LanguageContext`, `useApiResource`, `PortfolioLightbox`, and `SalesDashboard`. The initial `useEffect` omission was corrected in `182054f`; no current missing-hook import was identified by source search.

### Features, models, permissions and verification

| Feature/workflow | Frontend / API | Models and rules | Permission | Status |
|---|---|---|---|---|
| Public service catalog | Services, service details, Portfolio; `GET /services`, `GET /services/:slug` | `Service`; active-only public query, validated filters/pagination | Public | Unit tests for official catalog selection; database NOT TESTED |
| Project portfolio | Home/Portfolio; `GET /projects`, `GET /projects/:slug` | `Project`; only published records are public | Public | Static/unit/build; database NOT TESTED |
| Careers/application intake | Careers; `GET /jobs`, `GET /jobs/:slug`, `POST /applications` | `Job`, `Application`; applications may reference an active job; CV is a bounded string field, not an uploaded file | Public create; admin list/detail/update | Static/unit/build; persistence/CV hosting NOT TESTED |
| Contact intake | Contact page; `POST /contact` | `ContactMessage`; public limiter; admin-only list/detail/status update | Public create; admin reads/updates | Rate-limit/unit tests; persistence NOT TESTED |
| Public quote request | Portfolio; `POST /contact/quote-request`, `/quote-request/pdf` | Validates submitted service IDs/quantities and resolves active catalog pricing on server; creates a ContactMessage; PDF explicitly says it is indicative, not official | Public, rate limited | Client/server unit tests; end-to-end PDF/inbox NOT TESTED |
| Authentication | Auth page/context; register/login/me/logout | `User`; bcryptjs hash, JWT HS256, token-version check on each request | Registration creates only `user`; login rejects inactive accounts; `/me` and logout require bearer token | Unit test source present; Mongo integration NOT TESTED |
| Service administration | No dedicated routed management page found; service API client exists | `Service` | Admin-only create/manage/update/delete | API source only; UI workflow NOT PRESENT |
| Project/job administration | No dedicated routed management page found; clients exist | `Project`, `Job`; deletion of a job with applications returns conflict | Admin-only writes | API source only; UI workflow NOT PRESENT |
| Sales dashboard and quote CRUD | SalesDashboard; `/dashboard`, `/quotes`, `/quotes/:id` | `Quote`, `QuoteSequence`, service-price snapshots; totals calculated on server; sequence and quote creation transactional | Admin sees all; sales agent sees only owned quotes | Domain/sales middleware tests; transaction integration NOT TESTED |
| Quote status / retainers | SalesDashboard; `/quotes/:id/status`, `/retainer-collections` | Status transitions are forward-only; approval creates idempotent `RetainerCollection` installments in same transaction | Admin or sales agent; collection data is ownership-filtered | Domain tests; Mongo workflow NOT TESTED |
| Quote / retainer payments | SalesDashboard; `/quotes/:id/payments`, `/retainer-collections/:id/payments` | `PaymentIdempotency`; transaction, request hash, replay authorization and outstanding-balance guard | Admin or owning sales agent; quote must be approved | Unit payment tests; real index/transaction concurrency NOT TESTED |
| Quote PDF | SalesDashboard; `GET /quotes/:id/pdf` | PDFKit; safe text formatting; payment summary computed from stored payments | Admin or owning sales agent | Static/unit coverage; actual file download NOT TESTED |
| Agent/user management | No separate user-management page found | `User`; safe output excludes password; role changes increment token version; last-admin and self-deletion protections use transaction guard | Admin-only | Unit tests; Mongo transaction NOT TESTED |
| Privacy policy | No React route or API endpoint found | None | N/A | NOT PRESENT in inspected application |

### User roles

The only declared roles are `admin`, `sales_agent`, and `user` (`server/models/User.js`). `authenticate` loads the current user from MongoDB, rejects inactive users and stale token versions, and accepts only these roles. `requireAdmin` gates administrative mutations and sensitive inbox/application/user reads. `requireSalesRole` allows only `admin` and `sales_agent`. Non-admin sales users are limited to their own quote and installment records.

## API endpoint inventory

Base path: `/api`. Unless noted, successful JSON responses use `{ success: true, data: ... }`; errors use `{ success: false, error: { message, ... } }`. List endpoints include pagination metadata. IDs in path parameters are validated for routes that use `validateObjectId()`.

| Method | Path | Auth / role | Validation and database behavior |
|---|---|---|---|
| GET | `/health` | Public | Returns 200 when Mongo is connected, otherwise 503; exposes only connected/disconnected state |
| POST | `/auth/register` | Public; rate limited | Strict fields, password policy, bcrypt hash; always creates `user` |
| POST | `/auth/login` | Public; rate limited | Generic 401 for bad credentials; issues JWT on success |
| GET | `/auth/me` | Authenticated | Returns safe current-user fields |
| POST | `/auth/logout` | Authenticated | Increments tokenVersion to revoke current tokens |
| GET | `/services` | Public | Active records, validated filters/search/pagination |
| GET | `/services/manage` | Admin | All service records |
| GET | `/services/:slug` | Public | Active service or 404 |
| POST | `/services` | Admin | Creates Mongoose-validated service |
| PUT | `/services/:id` | Admin | Allow-listed fields, Mongoose validators |
| DELETE | `/services/:id` | Admin | Deletes service |
| GET | `/projects` | Public | Published records, validated filters/search/pagination |
| GET | `/projects/:slug` | Public | Published project or 404 |
| POST | `/projects` | Admin | Creates validated project; requires image/media URL |
| PUT | `/projects/:id` | Admin | Allow-listed fields, validators |
| DELETE | `/projects/:id` | Admin | Deletes project |
| GET | `/jobs` | Public | Active records; validated type/sort/pagination |
| GET | `/jobs/:slug` | Public | Active job or 404 |
| POST | `/jobs` | Admin | Creates validated job |
| PUT | `/jobs/:id` | Admin | Allow-listed fields, validators |
| DELETE | `/jobs/:id` | Admin | 409 when applications exist; otherwise deletes |
| GET | `/applications` | Admin | Filters/paginates; CV omitted from list |
| POST | `/applications` | Public; rate limited | Allow-listed fields; optional active job reference; CV remains user-supplied string |
| GET | `/applications/:id` | Admin | Returns application with populated job; includes CV field |
| PUT | `/applications/:id` | Admin | Status-only update, enum validators |
| POST | `/contact` | Public; rate limited | Creates contact message |
| GET | `/contact` | Admin | Filtered/paginated inbox |
| POST | `/contact/quote-request` | Public; rate limited | Re-resolves server-side active services/prices; creates inbox message |
| POST | `/contact/quote-request/pdf` | Public; rate limited | Generates indicative PDF from validated server-resolved request |
| GET | `/contact/:id` | Admin | Reads one contact message |
| PUT | `/contact/:id` | Admin | Status-only update |
| GET | `/dashboard/summary` | Admin or sales agent | Aggregate counts; agents list only for admins |
| GET | `/quotes` | Admin or sales agent | Admin may filter by agent; sales agent sees own quotes |
| POST | `/quotes` | Admin or sales agent | Transactional server calculation and quote sequence allocation |
| GET | `/quotes/:id` | Admin or owning sales agent | Reads accessible quote |
| PUT | `/quotes/:id` | Admin or owning sales agent | Only unpaid drafts; recalculates amounts; transactional |
| GET | `/quotes/:id/pdf` | Admin or owning sales agent | PDFKit file; private/no-store |
| POST | `/quotes/:id/status` | Admin or owning sales agent | Validated state transition; approval creates retainer installments transactionally |
| POST | `/quotes/:id/payments` | Admin or owning sales agent | Requires `Idempotency-Key`; approved quote, positive amount and balance guard |
| GET | `/retainer-collections` | Admin or owning sales agent | Ownership filter and optional upcoming/overdue/received/partial state |
| POST | `/retainer-collections/:id/payments` | Admin or owning sales agent | Requires `Idempotency-Key`; accessible installment and outstanding-balance guard |
| GET | `/users` | Admin | Filtered/paginated safe user fields |
| POST | `/users/agents` | Admin | Creates only `sales_agent`, hashes password |
| PATCH | `/users/agents/:id` | Admin | Activates/deactivates only sales-agent record; revokes old tokens |
| GET | `/users/:id` | Admin | Safe user fields |
| PUT | `/users/:id` | Admin | Allow-listed profile/role fields; prevents self-demotion and last-admin demotion |
| DELETE | `/users/:id` | Admin | Prevents self-delete and deletion of last admin; see finding F-01 below |

## Database models, relationships and indexes

| Model | Important fields / references | Declared indexes and observations |
|---|---|---|
| `User` | name/email/password hash/role/isActive/tokenVersion | unique email; `{ role, createdAt }`; `isActive` indexed |
| `Service` | title/slug/category/price/currency/isActive | unique slug; `{ isActive, category, createdAt }`; demo fixtures use explicitly fictional local prices |
| `Project` | slug/category/media/portfolioSection/client/published/featured | unique slug; text index on title/description/client; `{ isPublished, featured, createdAt }` |
| `Job` | slug/department/type/active | unique slug; `{ isActive, department, createdAt }` |
| `Application` | optional `job -> Job`, candidate fields/status/CV string | `{ job, createdAt }`; `{ status, createdAt }`; email indexed |
| `ContactMessage` | public sender/subject/message/status | `{ status, createdAt }`; email indexed |
| `Quote` | unique immutable quoteNumber, `createdBy -> User`, line items with optional `service -> Service`, payments and derived totals | unique quoteNumber; `{ createdBy, createdAt }`; `{ status, createdAt }`; `{ paymentStatus }` |
| `QuoteSequence` | `_id: quote`, monotonic value | built-in `_id` uniqueness; updated inside quote-creation transaction |
| `RetainerCollection` | `quote -> Quote`, quote-line-item ID, installment number, due date/payments | unique `{ quote, quoteLineItem, installmentNumber }`; `{ status, dueAt }`; quote/due/status fields indexed |
| `PaymentIdempotency` | `actorId -> User`, key, SHA-256 request hash, response snapshot | unique `{ actorId, key }`; deployment must ensure this index exists |

All models use strict schema mode; the main business models use timestamps. No separate migration framework or automated production schema/index migration is present in inspected package scripts. Mongoose schema indexes are declared; actual production index state is NOT TESTED.

## Security findings

| ID | Severity | Status | Evidence / impact |
|---|---|---|---|
| F-01 | Medium | **Fixed in this audit; unit tested** | Deleting a user who owns quotes removed the referenced `User` while quote records retained `createdBy`. This left dangling ownership references and obscured history. Account deletion now checks quote ownership within the existing admin-account transaction and returns a conflict instead; deactivation remains available. |
| F-02 | Medium | Open / deployment-dependent | `server/middleware/publicFormRateLimit.js` uses the default process-local in-memory store. Limits do not aggregate across Render/multi-instance workers, so effective throttling scales with instance count and resets on restart. Evaluate a shared rate-limit store and trusted proxy configuration before scaling. |
| F-03 | Low | Open | `server/server.js` disables `x-powered-by` and restricts CORS origins but does not configure a security-header middleware or explicit CSP/HSTS/nosniff/frame policy. Add/verify headers at the trusted edge or application, accounting for the site's media/embedding requirements. |
| F-04 | Low | Open / operational | Payment safety depends on the unique `PaymentIdempotency(actorId,key)` index and MongoDB transaction support. Model and tests declare/check the requirement, but this audit could not inspect production index state or confirm deployment topology. |
| F-05 | Low | Open / operational | Bearer tokens are stored by the browser API/auth context in local storage; an XSS defect would expose them. No exploitable XSS sink was confirmed in the inspected React rendering, but CSP and dependency/runtime checks remain deployment tasks. |

No confirmed authentication bypass, role escalation, quote-price trust issue, or payment-idempotency logic failure was identified by static review and safe unit tests. This is not a penetration test.

## Functional and implementation findings

| ID | Severity | Status | Finding |
|---|---|---|---|
| F-01 | Medium | Fixed | Quote owner references could be orphaned when an admin deleted a user. See security findings; safeguard added within existing transaction helper. |
| F-06 | Medium | Open / not verified | There is no dedicated application/CV management page or upload/download implementation in the routed React UI; backend application detail is admin-only and returns the CV string. The field's storage/URL contract and safe serving behavior need a product decision before claiming CV access works end-to-end. |
| F-07 | Low | Open | README/deployment and environment templates are not a substitute for verified target-specific configuration. The audit deliberately did not inspect local `.env` files or contact Render; confirm API origin, CORS allow-list, Mongo replica-set/index setup, and `VITE_API_URL` privately before release. |
| F-08 | Low | Open | The privacy-policy page requested in the audit brief is not present in the React router or source inventory. Legal/product owner must supply approved policy content and a route if required. |
| F-09 | Low | Open | No linter, type-check, or frontend test-runner script is defined in package manifests. Current frontend unit tests are run with Node's test runner; React UI/browser interaction coverage is absent. |

## Demo data

The opt-in demo seed at `server/seed/seedDemoData.js` creates fictional users for all three declared roles, six fictional service catalog entries with explicitly non-commercial prices, three fictional portfolio projects, one fictional opening/application/contact, two quotes, and three retainer installments. It uses stable reserved IDs, the application's `bcryptjs` password hashing, schema validation, collision checks, and one MongoDB transaction. Demo pricing and sales records are examples only and are not ZAYER Digital offers or verified business results.

### Required safeguards and local-only credentials

The scripts fail closed unless all conditions hold: `NODE_ENV` is `development` or `test`; `ZAYER_DEMO_SEED=1` is explicitly set; `MONGO_URI` is a `mongodb://` loopback URI; its database name is exactly `zayer_digital_test`; the connected effective database name matches; and the connected topology reports a writable single-member replica set whose advertised host/port match the URI. No Atlas URI, production DB, multi-member cluster, or ordinary standalone MongoDB is accepted. The replica-set restriction is required because the seed uses a transaction; do not weaken it to get around local setup.

Configure a local one-member MongoDB replica set and initialize it once with `rs.initiate()` in the local shell. Then, in PowerShell from the repository root, set only local development values for the command:

```powershell
$env:NODE_ENV = 'development'
$env:ZAYER_DEMO_SEED = '1'
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/zayer_digital_test?replicaSet=rs0'
npm run seed:demo --workspace zayer-digital-server
```

Use that same URI and development environment to run the local API. Do not copy a production URI from a secret store or `.env` file into these commands. The fictional login accounts (all use the demo-only password `ZayerDemo-Local-2026!`) are:

| Role | Local demo email |
|---|---|
| Admin | `demo.admin@zayer.local` |
| Sales agent | `demo.sales@zayer.local` |
| Standard user | `demo.user@zayer.local` |

These credentials must never be deployed or reused. The idempotent seed upserts its reserved records and keeps `QuoteSequence` at or above the reserved demo quote numbers. To remove only the fixture records, repeat the same safety environment and run `npm run reset:demo --workspace zayer-digital-server`. The reset removes only documents at the hard-coded demo IDs; it does not drop collections, delete arbitrary API/Postman records, reset the monotonic quote sequence, or modify non-demo IDs. Both commands are transactional. A failed guard or identity collision aborts before commit.

The Postman local environment template is in `docs/postman/`. It uses the seed IDs, contains blank secret/token variables, and defaults to loopback. The collection refuses a URL that is not loopback `/api`. Some tests intentionally create records without corresponding delete endpoints (applications, contacts, public quote requests and sales quotes); those remain until explicitly handled in the disposable test DB. `reset:demo` does not remove them, so use a fresh disposable database for repeatable clean end-to-end runs.

## Reproducible verification and exact scope

### Checks run in this audit

The checks below were run after the audit changes. `PASS` indicates only the named check succeeded; it is not evidence of a live deployment or MongoDB workflow.

| Check | Command | Status |
|---|---|---|
| Initial Git state | `git status --short; git branch --show-current; git --no-pager log -5 --oneline --decorate` | PASS — clean `main`, HEAD `182054f` |
| Frontend production build | `npm run build` | PASS — Vite production build completed (1,640 modules) |
| Safe server + frontend unit tests | `node --test server/test/demoSeedSafety.test.js server/test/demoData.test.js server/test/userAccountMutations.test.js server/test/paymentIdempotency.test.js server/test/publicFormRateLimit.test.js server/test/publicQuoteRequest.test.js server/test/quoteDomain.test.js server/test/salesMiddleware.test.js server/test/tokenVersion.test.js client/src/data/officialServices.test.js client/src/utils/authRedirect.test.js client/src/utils/paymentIdempotency.test.js client/src/utils/publicQuote.test.js` | PASS — 53 tests, 53 passed, 0 failed |
| Backend syntax | PowerShell loop invoking `node --check` for each non-`node_modules` `server/**/*.js` file | PASS — 74 files |
| Diff whitespace | `git diff --check` | PASS — no whitespace errors |
| Postman artifact validation | Node JSON parse and consistency check against `DEMO_IDS` | PASS — 9 folders, 73 requests, 29 environment variables, all named status expectations present, seed IDs match and local loopback guard present |
| Mongo auth integration | Not invoked | BLOCKED — destructive test requires explicitly opted-in disposable local replica set |
| Sales/payment integration | Not invoked | BLOCKED — requires isolated local replica set and explicit opt-in |
| Postman API run | Not invoked | NOT TESTED — no isolated local API/database was configured |
| Browser end-to-end | Not invoked | BLOCKED — no safe local backend/API target supplied |
| Demo seed/reset execution | Not invoked | BLOCKED — no disposable local replica set was configured; safety checks and fixture schemas were unit-tested only |

`npm test` was intentionally not used: the default Node test discovery includes `server/test/auth.test.js`, whose setup calls `dropDatabase()` after dedicated-database guards. Run no integration suite until the isolated loopback replica set and explicit opt-ins described in `server/test/README.md` are prepared.

## Prioritized remediation plan

1. **Before release:** verify production DB topology supports transactions; inspect/ensure the unique idempotency and quote/retainer indexes via an approved index rollout; validate CORS, proxy trust, rate-limit storage, and frontend API URL without exposing secrets.
2. **Before production scale-out:** replace process-local rate limiting with a shared store or edge limit and configure the trusted proxy boundary precisely.
3. **Business/data integrity:** keep the new deletion guard; add an integration regression test when a disposable local replica set is available.
4. **Careers:** define approved CV upload/storage/access policy and implement/administer it or clearly treat the field as an external URL only.
5. **Compliance/UI:** decide whether a privacy policy page is required and provide approved content.
6. **QA:** add React/browser tests and a non-destructive local API test harness; keep destructive integration suites opt-in and isolated.
