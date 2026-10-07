# ZAYER Digital

MERN application foundation for the ZAYER Digital public website and future administration platform. The existing React pages are under `client/`; the Express/Mongoose API foundation is under `server/`.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- MongoDB running locally, or a MongoDB connection URI

## Setup

1. Install workspace dependencies from the project root:

   ```sh
   npm install
   ```

2. Create `server/.env` from `server/.env.example`, then set `MONGO_URI`, a randomly generated `JWT_SECRET` of at least 32 characters, `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD`.
3. Create `client/.env` from `client/.env.example` to configure `VITE_API_URL`. The sample URL uses port `5099`; set `PORT=5099` in `server/.env` to match it. The frontend calls the API directly, and the backend allows the configured frontend origin through `CLIENT_URL`.
4. Add the supplied hero assets as `client/public/videos/hero-1.mp4` and `client/public/videos/hero-2.mp4`.

## Run locally

- `npm run client` starts the Vite client on port 5173.
- `npm run server` starts the API on port 5099 when using the sample `server/.env`; MongoDB must be reachable.
- `npm run dev` starts both processes.
- `npm run build` builds the client.
- `npm run seed:admin --workspace zayer-digital-server` creates the configured admin account once.
- `npm test --workspace zayer-digital-server` runs the backend tests, including authentication, authorization, and the official service catalog checks.
- `GET http://localhost:5099/api/health` reports API and database readiness when using the example environment.

The client API layer reads the bearer token from the single `localStorage` key `zayer_auth_token`; safe user details remain in memory and are reloaded through `/api/auth/me` on refresh. The token is removed automatically after an authenticated request receives `401 Unauthorized`. No password or server-side secret is stored in the client.

The client exposes `/login` and `/register` for the Phase 5 auth API. Registration follows the API contract and does not sign the user in automatically. Reusable `ProtectedRoute` and `AdminRoute` guards are available for protected screens; no admin/dashboard routes are part of Phase 6.

The backend currently includes six Mongoose models and REST controllers/routes for services, projects, jobs, applications, contact messages, and users. Public service/project/job reads return active or published content only. Lists support pagination; content lists support filtering, sorting, and search where applicable.

## Public legacy content migration

The public Home, About, Portfolio, Careers, and Contact pages retain the legacy page content and use the existing API resources rather than seeded React fixtures. Populate the existing admin-managed resources to make database content appear publicly:

- Projects accept `mediaUrl` and `mediaType` (`image`, `video`, or `youtube`), `portfolioSection` (`creative`, `web`, or `impact`), `sector`, and an optional `linkUrl`. Keep `image` for existing records; a project must have either `image` or `mediaUrl`.
- Services may include `price` and a three-letter `currency` code (default `TND`). The public quote calculator keeps totals separate by currency.
- To synchronize the six service names and descriptions from the official Business Profile into the existing Service collection, run `npm run sync:official-services --workspace zayer-digital-server` after configuring MongoDB. This idempotent sync leaves existing prices, currencies, features, and technologies unchanged.
- Jobs may include `experience`. Applications can omit `job` for open applications; the careers form accepts a shareable CV URL in `cv`. Binary CV uploads are not provided by the current API.
- Contact messages may include `company`; the contact form submits to the existing `/api/contact` endpoint.

The supplied home and services hero videos are served from `client/public/videos/hero-1.mp4` and `client/public/videos/hero-2.mp4`. The portfolio UI renders media URLs from Project records; portfolio media files/records must be supplied through the existing content workflow.

## Current phase boundary

Completed: project reorganization (Phase 1), Node/Express/MongoDB configuration (Phase 2), Mongoose models (Phase 3), and the REST API layer (Phase 4).

**Authentication:** registration and login are rate-limited. Public registration always creates the `user` role; create admins only with the explicit seed command. Protected management routes require `Authorization: Bearer <token>` and an admin role. The JWT secret is required and never checked into source control. Passwords use bcrypt with 12 rounds and a 12-character minimum. User passwords are excluded from regular queries and cannot be changed via the user-management endpoint.

`JWT_EXPIRES_IN` accepts a duration such as `15m`, `1h`, or `7d` and defaults to `15m`. The admin seed requires non-empty `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; the admin password follows the same password policy as registration.

## API routes

- Services: `GET /api/services`, `GET /api/services/:slug`, `POST /api/services`, `PUT /api/services/:id`, `DELETE /api/services/:id`
- Projects: `GET /api/projects`, `GET /api/projects/:slug`, `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`
- Jobs: `GET /api/jobs`, `GET /api/jobs/:slug`, `POST /api/jobs`, `PUT /api/jobs/:id`, `DELETE /api/jobs/:id`
- Applications: `POST /api/applications`, `GET /api/applications`, `GET /api/applications/:id`, `PUT /api/applications/:id`
- Contact: `POST /api/contact`, `GET /api/contact`, `GET /api/contact/:id`, `PUT /api/contact/:id`
- Users: `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`
- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`

Collection endpoints accept `page` and `limit` query parameters (default page `1`, default limit `20`, maximum limit `100`). Search, filter, and sort query parameters are validated by each collection controller.

Services, projects and jobs support public list/detail `GET` requests; their write operations require admin authorization. Applications and contact messages may be submitted publicly, while all reads and updates require admin authorization. All user endpoints require admin authorization.
