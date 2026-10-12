# ZAYER Digital API QA collection

These are importable Postman v2.1 artifacts for an **isolated local development/test API only**:

- `ZAYER_Digital_API.postman_collection.json`
- `ZAYER_Digital_Local.postman_environment.json`

The collection includes a pre-request safety gate. It stops requests unless `baseUrl` resolves to `localhost`, `127.0.0.1`, or `::1` and has the `/api` path. Do not remove or bypass this gate. It is a URL guard, not a substitute for using a disposable database.

## Safe setup

1. Set up the server's documented local replica set and database prerequisites in [the demo database guide](../audit/TECHNICAL_AUDIT.md#demo-data).
2. Seed only the dedicated local test database with `npm run seed:demo` from `server`. Set `NODE_ENV=development`, `ZAYER_DEMO_SEED=1`, and a loopback `MONGODB_URI` whose database name is exactly `zayer_digital_test`. Never use a production or Atlas URI.
3. Start the API against that same local database. The collection's default API address is `http://127.0.0.1:5000/api`; update it only to another loopback address if your local server uses a different port.
4. Import both JSON files in Postman and select the environment. Enter `ZayerDemo-Local-2026!` into each demo account's secret password variable. The local-only seed accounts are `demo.admin@zayer.local`, `demo.sales@zayer.local`, and `demo.user@zayer.local`; all three demo roles share that fictional local-only password. Set `testUserPassword` to the same password or another value meeting the server's password policy.
5. Run requests in folder order. First register the isolated test account, then log in as admin, sales agent, and standard user. The collection's tests save tokens and created object IDs into the selected environment.

Run the collection only against the isolated `zayer_digital_test` database. The collection makes real writes: it creates disposable service/project/job/agent/user records and deletes those specific records in later requests. Contact messages, applications, public quote requests, official quotes, payment records and payment idempotency records persist because their API workflows do not provide safe delete endpoints. Quote numbering is monotonic and not reset. Do not run against a shared database or any environment containing real users or business data.

`npm run reset:demo` removes only documents with stable IDs reserved by the demo seed. It does not delete Postman-created records, drop collections, or decrement the quote sequence. Reset is not a general test-data cleanup mechanism. Use a fresh disposable local database when a clean end-to-end run is required.

## Coverage and limits

The collection covers the discovered API routes: health, authentication, public catalogues, catalog CRUD, careers and applications, contact and public quote requests, sales dashboard and quote lifecycle, quote PDF/payment, recurring collection/payment, and user/agent administration. It exercises common validation, forbidden access, missing/invalid credentials, payment idempotency, and PDF response headers.

The collection has **not been executed**. It is not evidence of passing API, database, payment, PDF, or authorization workflows. Those require a correctly configured local replica set, seeded demo records, local API process, and the environment's local-only credentials. In particular, a failing expectation must be investigated against the current API; do not change API security or business rules merely to satisfy a Postman assertion.

Some collection calls intentionally depend on previous calls in their folder: login calls populate token variables; create calls populate object-ID variables; later update/read/delete calls consume them. A full run is required to exercise dependent workflows. If requests are run individually, run the prerequisite login/create requests first.
