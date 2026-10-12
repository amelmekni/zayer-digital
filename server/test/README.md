# Server test safety

The `auth.test.js` integration test drops its target database before and after
the run, synchronizes indexes, and creates test accounts. Never point it at a
shared development, staging, or production MongoDB deployment.

Run it only against a disposable MongoDB instance bound to loopback, configured
as a single-node replica set so transactions are supported. Its explicitly
configured `MONGO_TEST_URI` must name the reserved database
`zayer-digital-auth-test` and include the replica-set option. The test refuses
to connect unless `MONGO_TEST_ALLOW_DESTRUCTIVE=1` is also explicitly set. It
then uses a process-specific database name, such as
`zayer-digital-auth-test-12345`, to avoid collisions between local runs.

Do not run `auth.test.js` as a general-purpose test command. It is destructive:
it drops its selected database and synchronizes indexes. Run it only as a
separately authorized operation after preparing its own disposable auth-test
database, setting `MONGO_TEST_URI` to that database, and explicitly setting
`MONGO_TEST_ALLOW_DESTRUCTIVE=1`. Never use the payment-test database for it.

The local MongoDB instance must contain no valuable data. The safety checks
reject remote hosts, missing opt-in, other database names, and URIs without a
replica-set option; they cannot verify whether a local MongoDB process is
actually disposable, so use an isolated instance/container dedicated to tests.

## Payment idempotency integration setup

Payment integration tests must use a separate disposable MongoDB replica set,
not the auth test database and never a shared environment. The
`PaymentIdempotency` model declares a unique `{ actorId: 1, key: 1 }` index.
Do not call `syncIndexes()` for this setup: it can remove indexes not declared
by the model. On the dedicated test database only, a controlled setup step may
create the model's indexes with `await PaymentIdempotency.createIndexes()`,
then verify that `listIndexes()` reports both key fields and `unique: true`.
The test must fail before payment requests if the exact index is absent or is
not unique. The test environment must support multi-document transactions.

The integration suite connects only to its explicitly configured disposable
replica-set URI, selects a process-specific reserved test database, creates
and verifies indexes, runs payment/replay/concurrency assertions, and closes
the connection. Do not add index synchronization or automatic index creation
to production startup. The unique index must be managed deliberately by the
deployment's controlled schema/index process.

Payment integration tests must use the separate `MONGO_PAYMENT_TEST_URI`
variable and require `MONGO_PAYMENT_TEST_ALLOW=1`. The safety helper
`validatePaymentTestDatabase` restricts the URI to one loopback MongoDB host,
the reserved `zayer-digital-payment-test` database, and a configured replica
set, then selects a process-specific database name. `assertPaymentIdempotencyIndex`
checks the live `listIndexes()` result for the exact ordered key pattern and
`unique: true`. These guards are unit tested without MongoDB:

```powershell
node --test test/paymentTestDatabaseSafety.test.js
```

## Sales workflow integration suite

`salesWorkflows.integration.test.js` exercises quote creation and sequence
rollback, quote approval and persisted retainer installments, quote and
retainer payments, idempotent replay/conflicts, sales-role and ownership
checks, and concurrent duplicate quote payments against MongoDB.

Run it only after preparing an isolated, disposable local MongoDB instance
bound to loopback as a single-node replica set. The suite requires
`MONGO_PAYMENT_TEST_URI` to name `zayer-digital-payment-test` and include the
replica-set option, plus `MONGO_PAYMENT_TEST_ALLOW=1`. It verifies the actual
replica-set name and single-node membership before making requests. Before any
index or fixture writes, it also requires the advertised member, responding
member (`hello.me`), and the MongoDB driver's single-server topology address to
resolve consistently to the configured loopback host and port. It accepts
`localhost`, IPv4 loopback, or IPv6 loopback; ambiguous or unavailable topology
metadata causes the suite to fail closed. The URI guard selects
`zayer-digital-payment-test-<process id>`; the suite refuses to continue if
its quote, retainer, payment-idempotency, or quote-sequence collections already
contain documents.

Before requests, the suite explicitly creates and verifies the unique
`Quote.quoteNumber`, `RetainerCollection { quote, quoteLineItem,
installmentNumber }`, and `PaymentIdempotency { actorId, key }` indexes. It
does not call `syncIndexes()` or `dropDatabase()`. Cleanup deletes only the
suite's tracked quotes and quotes owned by the unique users created for that
run, their related installments and keyed idempotency records, those users,
and the quote sequence record if it was absent at setup. All cleanup is
restricted to that process-specific database. The suite overrides `MONGO_URI`
with the validated payment-test URI and generates a fresh test-only
`JWT_SECRET` in memory.

From the `server` directory, after explicitly preparing and authorizing the
disposable replica set, run only:

```powershell
$env:MONGO_PAYMENT_TEST_URI = "mongodb://127.0.0.1:27017/zayer-digital-payment-test?replicaSet=rs0"
$env:MONGO_PAYMENT_TEST_ALLOW = "1"
node --test test/salesWorkflows.integration.test.js
```

Do not run `npm test`, since it discovers `auth.test.js`, which drops its
selected database. Do not point either integration suite at a shared or
production deployment. The test URI guard cannot prove that a local MongoDB
process is disposable; use an isolated instance/container with no valuable
data.
