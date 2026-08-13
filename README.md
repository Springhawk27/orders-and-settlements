# Orders and Settlements

Create orders with line items, record full or partial payments against them, and see what is
outstanding, what is due and what is overdue.

Payments are recorded through a single atomic, idempotent write, so an order can never be
over-paid — not even when two payments arrive at the same moment.

> Work in progress. The API reference, status rules, deployed URL and design notes land as each
> part is built.

## Stack

| Layer    | Choice                                                             |
| -------- | ------------------------------------------------------------------ |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4                       |
| Backend  | Node.js, Express 5, TypeScript, Mongoose 9                         |
| Database | MongoDB Atlas — a replica set, so payment writes are transactional |
| Shared   | Zod schemas and money helpers used by both apps                    |
| Hosting  | Vercel, two projects from one repository                           |

## Repository layout

```
apps/web         Next.js frontend
apps/api         Express REST API
packages/shared  Zod schemas and money helpers used by both apps
```

The two apps never import from each other. Anything they have to agree on — request shapes,
validation rules, how money is parsed — lives in `packages/shared`, so the rules cannot drift
apart between the client and the server.

They deploy independently: separate builds, separate environment variables, separate domains.
One repository, two deployments.

## Getting started

Requires Node 20+ and pnpm 11+.

```bash
pnpm install
```

One install at the root covers all three packages.

```bash
cp apps/api/.env.example apps/api/.env    # set DATABASE_URL and the JWT secrets
cp apps/web/.env.example apps/web/.env

pnpm dev
```

| Command          | Does                                  |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Run both apps                         |
| `pnpm dev:api`   | API only — http://localhost:5000      |
| `pnpm dev:web`   | Frontend only — http://localhost:3000 |
| `pnpm build`     | Build both apps                       |
| `pnpm test`      | Run the test suites                   |
| `pnpm lint`      | Lint every package                    |
| `pnpm typecheck` | Type-check every package              |
| `pnpm format`    | Format the repository                 |

Shared dependency versions are declared once in `pnpm-workspace.yaml` under `catalog:` so the
three packages cannot end up on different majors.
