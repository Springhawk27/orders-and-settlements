# Orders and Settlements

Create orders with line items, record full or partial payments against them, and see what is
outstanding, what is due and what is overdue.

Payments are applied through a single atomic, idempotent write, so an order can never be
over-paid, even when several payments arrive at the same instant.

**Live app:** https://orders-and-settlements-web-drab.vercel.app

**API docs:** https://orders-and-settlements-api-beta.vercel.app/api/docs

**Demo account**, already loaded with 26 orders across every status and ageing bucket:

```
demo@settlements.app
demo-password-2026
```

## Quick start

Needs Node 20+, pnpm 11+, and a MongoDB connection string pointing at a **replica set**. Payment
writes run inside a transaction and MongoDB only offers those on a replica set; Atlas is one on
every tier including the free M0.

```bash
pnpm install                              # one install covers all three packages

cp apps/api/.env.example apps/api/.env    # set DATABASE_URL and the two JWT secrets
cp apps/web/.env.example apps/web/.env    # API_ORIGIN, defaults to http://localhost:5000

pnpm seed                                 # demo account and 26 sample orders
pnpm dev                                  # API on :5000, web on :3000
```

Open http://localhost:3000 and sign in with the demo credentials.

`pnpm test` runs 145 tests. `pnpm build`, `pnpm lint` and `pnpm typecheck` cover every package.

```
apps/web         Next.js 16 frontend
apps/api         Express 5 REST API
packages/shared  Zod schemas and money helpers used by both apps
```

The two apps never import from each other. Everything they must agree on (request shapes,
validation rules, how money is parsed) lives in `packages/shared`, so client and server cannot
drift. They deploy independently as two Vercel projects from the one repository.

## Verifying the sample scenario

| Step                                     | Expected                    | Result                             |
| ---------------------------------------- | --------------------------- | ---------------------------------- |
| Create an order, 2 × $500, due in 7 days | $1,000 total                | `pending`                          |
| Record $400                              | `partially_paid`, $600 due  | as expected                        |
| Record $600                              | `paid`, $0 due              | as expected                        |
| Attempt another $1                       | rejected with a clear error | `409`, message on the amount field |

Pinned as a test: `the payment scenario from the brief > walks 1000 -> 400 -> 600 -> rejected`.

On the last step the UI disables the button and shows "Paid in full", and the API independently
returns `409` if a client bypasses the UI. The rejection is a server rule, not a UI courtesy.

## API overview

Base path `/api/v1`. Auth is a pair of httpOnly cookies; `Authorization: Bearer` also works.
Interactive docs at `/api/docs` are generated from the same Zod schemas the API validates with, so
they cannot describe a contract the server does not enforce.

| Method | Path                                           |                                                                              |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| POST   | `/auth/register` `/login` `/refresh` `/logout` | Sessions. Refresh tokens rotate on use                                       |
| GET    | `/auth/me`                                     | The signed-in user                                                           |
| GET    | `/orders`                                      | List, with `status`, `q`, `from`, `to`, `page`, `limit`, `sortBy`, `sortDir` |
| POST   | `/orders`                                      | Create. Totals computed server-side; anything sent is ignored                |
| GET    | `/orders/export`                               | CSV for a date range                                                         |
| GET    | `/orders/:id`                                  | One order with its line items                                                |
| PATCH  | `/orders/:id`                                  | Update. Line items only while unpaid                                         |
| DELETE | `/orders/:id`                                  | Delete. Refused if payments exist                                            |
| GET    | `/orders/:id/audit`                            | Append-only activity trail                                                   |
| GET    | `/orders/:orderId/payments`                    | Payment history, including reversals                                         |
| POST   | `/orders/:orderId/payments`                    | Record a payment. Accepts `Idempotency-Key`                                  |
| GET    | `/orders/:orderId/payments/reconcile`          | Recompute the balance from the payments and compare                          |
| POST   | `/payments/:id/void`                           | Write a reversing entry                                                      |
| GET    | `/dashboard/summary`                           | Outstanding, overdue, collections, status counts, ageing                     |

Success responses are `{ statusCode, success, message, meta?, data }`. Failures carry a field path
so a client can put the message on the input that caused it:

```json
{
  "success": false,
  "message": "That payment would exceed the order total",
  "errorMessages": [
    { "path": "amount", "message": "The most that can be recorded against this order is $600.00" }
  ]
}
```

That message is what the web app renders under the amount field. Rejections say what to do next,
not just that something was wrong.

## Status derivation and edge cases

Four statuses. Three are stored, one is derived, and the split matters.

| Status           | Condition                            | Stored |
| ---------------- | ------------------------------------ | ------ |
| `pending`        | No payments recorded                 | yes    |
| `partially_paid` | Some paid, less than the total       | yes    |
| `paid`           | Payments equal the total             | yes    |
| `overdue`        | Past the due date and not fully paid | no     |

The first three are a pure function of amount paid against the total. They only change when money
moves, so they are safe to persist and are written in the same atomic operation as the balance.

`overdue` depends on the current time, not on stored data. Nothing writes to the order when it
becomes overdue; a day simply passes. A stored value would be right when written and wrong the
next morning, and would need a nightly job to stay accurate. So it is computed on read:

```ts
displayStatus = paymentStatus === 'paid' ? 'paid' : isOverdue ? 'overdue' : paymentStatus;
```

**An order that was overdue but is now fully paid** resolves itself. Paying it sets
`paymentStatus: 'paid'`, so `isOverdue` is false, so it displays as `paid`. No cleanup job, no
stale rows. The history is not lost: `paidInFullAt` is stamped when the balance reaches zero and
`wasPaidLate` is true if that was after the due date, so the detail page reads "Settled 20 Sep
2026, after the due date".

**A due date is not late until the day after.** Due dates are stored at UTC midnight, so treating
`dueDate < now` as overdue would mark an order due today as late from the first second of the
morning. The rule is a full elapsed day.

**Filtering by overdue** means reproducing the condition the badge uses. Written twice they drift
and a row appears under a status it does not display, so both call `overdueCutoff(now)`. A test
asserts every row returned by `?status=overdue` also reports `displayStatus: 'overdue'`. The query
stays indexable: `{ paymentStatus: { $ne: 'paid' }, dueDate: { $lte: cutoff } }`.

**An order can be both partially paid and overdue,** and the dashboard counts it under both. One
is a stored fact about money, the other a derived fact about time.

**A zero-total order counts as paid.** Nothing is owed, so `pending` would be wrong.

## Concurrency: two payments at the same moment

**What the system does:** both requests are attempted. Neither is blocked or queued. Each is
evaluated against the balance as it stands at the moment it writes, so whichever fits is recorded
and whichever would exceed the total is rejected with `409` naming what is left.

| Two simultaneous payments on a $1,000 order | Outcome                                      |
| ------------------------------------------- | -------------------------------------------- |
| $600 and $600 (only one fits)               | One `201`, one `409`. Final: $600, 1 payment |
| $200 and $200 (both fit)                    | Both `201`. Final: $400, 2 payments          |

### Why the obvious implementation fails

```js
const order = await Order.findById(id); // 1
if (order.amountPaidMinor + amount > order.totalMinor) {
  // 2
  throw new Error('over-payment');
}
order.amountPaidMinor += amount;
await order.save(); // 3
```

```
 time   request A                 request B
  1     1 reads paid = 400
  2                               1 reads paid = 400
  3     2 400 + 600 <= 1000 ok
  4                               2 400 + 600 <= 1000 ok      <- same stale read
  5     3 writes paid = 1000
  6                               3 writes paid = 1000        <- $1,200 was collected
```

Both read the same value before either wrote, so the check passed twice. The order says it is
fully paid while $1,200 was taken against a $1,000 order, and the payments collection proves the
money arrived, so the books disagree with themselves. This is a time-of-check to time-of-use bug,
invisible in manual testing and in any test that does not run requests in parallel.

### What this does instead

The guard lives in the query filter, so the database evaluates it against the current document at
the moment of the update. There is no window between reading and writing:

```ts
Order.findOneAndUpdate(
  {
    _id,
    userId,
    $expr: { $lte: [{ $add: ['$amountPaidMinor', amount] }, '$totalMinor'] },
  },
  [
    { $set: { amountPaidMinor: { $add: ['$amountPaidMinor', amount] } } },
    { $set: { paymentStatus: { $switch: {/* derived from the new balance */} } } },
  ],
  { session, returnDocument: 'after', updatePipeline: true },
);
```

Single-document updates in MongoDB are atomic, so no other write can interleave between the match
and the update. Whichever request loses the race fails to match and gets `null` back. No lock, no
retry loop, one round trip.

The update is an aggregation pipeline rather than a plain `$set` so the new status is computed from
the new balance in the same operation. Deriving it in application code would mean using a value
read earlier, reintroducing the staleness the guard just removed.

A `null` result means either "not found" or "would over-pay", so the order is read back to tell
those apart and name the exact amount still allowed.

**There is also a transaction,** because recording a payment touches three documents: the payment,
the order balance, and the audit event. If the process dies between the first two, a payment exists
that the order does not know about. `withTransaction` makes all three commit or none. The two
mechanisms solve different problems: the transaction gives atomicity across documents, the `$expr`
guard gives correctness under concurrency.

**The proof.** A test fires eight simultaneous $200 payments at a $1,000 order and asserts exactly
five succeed. To check the test had teeth I removed the `$expr` guard and re-ran it: all eight
succeeded, collecting $1,600. The test fails when the protection is absent, which is the only thing
that makes it worth having.

## Idempotency

Networks fail after the server has already committed. The client times out, retries, and the
payment is recorded twice. This is the most common way payment systems double-charge people.

`POST /orders/:orderId/payments` accepts an `Idempotency-Key` header, stored on the payment with a
unique partial index on `{ userId, idempotencyKey }`. A retry returns the original payment with
`200` and `Idempotent-Replay: true` instead of creating a second one. Partial rather than plain
unique, so payments recorded without a key do not all collide on a missing value.

The web app generates one key per submission attempt and holds it in a ref, so a double click or a
resubmit after a timeout reuses it.

Failed requests are not replayed: only successful payments are keyed, so retrying a rejected
request re-evaluates it. An over-payment rejection depends on the balance at the time, and that
may legitimately have changed.

## Money handling

Every amount is an integer number of minor units. `unitPriceMinor: 50000` is $500.00. No floats in
storage or arithmetic anywhere. Parsing reads the digits either side of the decimal point rather
than multiplying by 100:

```js
19.99 * 100 === 1998.9999999999998;
```

`Math.round` would paper over that, but rounding hides the error rather than avoiding it, and it
compounds once amounts are summed across a ledger. Two tests assert the naive form is wrong and
this one is exact.

**No rounding happens anywhere.** Line totals are `quantity × unitPriceMinor`, integer times
integer, exact at any scale. There is no tax or discount, so no fractional value is ever produced.
Amounts arrive as decimal strings, are rejected if they carry more than two decimal places rather
than being silently rounded, and are formatted for display in exactly one place.

## Data model and indexes

Line items are embedded in the order: only ever read and written as part of it, and bounded in
count. Payments are a separate collection: unbounded over time, queried on their own, and
individually addressable so one can be voided.

`orders.amountPaidMinor` is denormalised. It could be summed from the payments, but storing it
makes the list page one indexed query instead of a `$lookup` per row. The payments remain the
source of truth and this is a cache, so a **reconciliation endpoint** recomputes the sum and
compares. The test suite asserts they agree after every scenario, including after concurrent writes
and voids. Duplication in a financial system needs a way to prove it has not drifted.

| Collection    | Index                                             | Query it serves                              |
| ------------- | ------------------------------------------------- | -------------------------------------------- |
| `users`       | `{ email: 1 }` unique                             | Login, one account per email                 |
| `orders`      | `{ userId: 1, createdAt: -1 }`                    | Default list page                            |
| `orders`      | `{ userId: 1, paymentStatus: 1, dueDate: 1 }`     | Status filter, overdue query, ageing buckets |
| `orders`      | `{ userId: 1, orderNumber: 1 }` unique            | Lookup and the per-user sequence             |
| `orders`      | `{ userId: 1, 'customer.nameLower': 1 }`          | Customer search                              |
| `payments`    | `{ orderId: 1, paidAt: -1 }`                      | Payment history on the detail page           |
| `payments`    | `{ userId: 1, idempotencyKey: 1 }` unique partial | Idempotent replay detection                  |
| `payments`    | `{ userId: 1, paidAt: -1 }`                       | Collections over a date range                |
| `auditEvents` | `{ entityType: 1, entityId: 1, at: -1 }`          | The activity timeline                        |

Field order is deliberate: `{ userId, paymentStatus, dueDate }` puts equality matches first and the
range comparison last, and reversing them would make the index unusable for that query.

Every index starts with `userId`, because that is how tenant isolation is enforced. Queries filter
on `userId` in the filter itself, never by fetching a document and checking ownership afterwards. A
post-fetch check is one forgotten line away from leaking and cannot use an index. Another user's
order returns `404`, not `403`, since a 403 would confirm the id exists.

Sorting always carries `_id` as a tiebreaker. Sorting on a field with duplicate values leaves those
rows in an undefined order, which shuffles the list between refreshes and lets skip/limit
pagination repeat one row while another never appears.

## Are orders editable after the first payment?

**Partly. Line items freeze, terms stay editable.**

Line items are what a payment was measured against. Changing them after money has arrived would
make the recorded payment describe a different order. A due date is not a claim about what was
owed, it is the term agreed for paying it, and extending terms is an ordinary business decision.
Forcing someone to void a payment to change a due date would push people into working around the
system, which is worse than a looser rule the audit trail makes safe.

| Once a payment exists     | Behaviour                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| Line items                | `409`. Frozen until every payment is voided                         |
| Due date, customer, notes | Allowed, and written to the audit trail                             |
| Deleting the order        | `409`. Financial records with money against them are not deleted    |
| Voiding a payment         | Allowed. Writes a reversing entry rather than removing the original |

The lock is not permanent: voiding every payment releases the line items again, because the thing
that justified freezing them is gone.

The UI states this at the point of use. The edit page renders line items read-only with the reason
and the amount collected, and the delete action is disabled with an explanation rather than failing
on click.

The audit trail records what changed, not what was submitted. A form posts every field it holds, so
recording all of them would log a due-date change as though the customer had been renamed too.

## Tests

145 tests. The API suite spins up an in-memory MongoDB replica set, because transactions need one.

**Payment allocation** — partial payments accumulate and the balance follows; concurrent payments
that together fit are all accepted; voiding writes a reversal and restores the balance;
reconciliation (`sum(payments) === amountPaidMinor`) holds after every scenario.

**Status transitions** — the full balance range from `pending` through `partially_paid` to `paid`;
a zero-total order counts as paid; `overdue` is never true for a paid order however late it
settled; the overdue boundary either side of the due date; ageing buckets at 30, 60 and 90 days.

**Over-payment rejection** — the sample scenario ending in a rejected $1; the error naming the
exact maximum allowed; eight simultaneous payments of which exactly five succeed; and verified to
fail when the guard is removed.

Also covered: tenant isolation, idempotent replay, the edit lock and its release after a void, CSV
escaping of a name containing a comma, stable pagination when sort values tie, and auth including
session rotation and identical responses for a wrong password and an unknown account.

## Assumptions and trade-offs

**A single currency, USD.** Every order stores its currency so supporting more is a
schema-compatible change, but accepting them today would not be: the dashboard sums outstanding
balances across all orders, and adding two currencies produces a meaningless number. Multi-currency
needs per-currency aggregation and a rate captured at payment time.

**One user's data is entirely their own.** No organisations, sharing or roles.

**A calendar date means UTC midnight,** so a due date does not shift by a day depending on where
the viewer is.

**Rate limits live in process memory.** Enough to slow credential stuffing, but on serverless each
instance counts separately.

**The web app proxies the API** rather than calling it cross-origin. `next.config.ts` rewrites
`/api/:path*` to the API origin, so the browser only talks to the web origin. Auth cookies stay
first-party `SameSite=Lax`, avoiding third-party cookie blocking and CORS preflights, and no token
sits in `localStorage` for an XSS bug to steal. The cost is one extra hop.

**Refresh tokens have a 30-second grace window.** Strict single-use rotation is the textbook rule
but signs people out during ordinary use: a second tab still holds the cookie the first exchanged,
and cookies are shared across tabs while client-side de-duplication is not. Replayed later than
that, a token is treated as stolen and every session is revoked. I found this by using the app, not
by testing it, because the test covered the attack and not the ordinary case.

**Server state lives in TanStack Query rather than Redux,** since orders and payments are cached
server state and invalidation on mutation comes with it.

**`bcryptjs` at cost 12** rather than argon2id, because it is pure JS with no native build to fail
on a serverless target.

## What I would improve before production

**Atlas network access is open to `0.0.0.0/0`,** because Vercel's functions have no fixed egress
IP. Production would use VPC peering or a static-egress proxy. A deployment constraint rather than
a design choice, and worth stating rather than hiding.

**Rate limiting needs a shared store** so the limit is global rather than per instance.

**Idempotency keys should expire and cover responses.** Today only successful payments are keyed
and the records live forever; a production version would store the response envelope and expire
keys after 24 hours.

**Customer search does not scale.** A prefix match uses the index, a contains match cannot. At
volume this wants a text index or a search service.

**Ageing is recomputed per request.** Fine here, but a large history wants a materialised daily
snapshot.

**Reconciliation should run on a schedule** and alert when the denormalised balance and the payment
sum disagree, rather than only being checked in tests and on demand.

**There is no end-to-end test suite.** Driving the real UI found three bugs the API tests could not
see, including that creating an order from the UI was broken because the client sent the schema's
parsed output to an endpoint expecting its input. Every automated check was green at the time. A
Playwright suite covering create, pay and void would close that gap permanently.
