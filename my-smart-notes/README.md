# Sentia

## Verification

The default automated suite is deterministic: it does not open a
browser, connect to the production database, or spend OpenAI credits.

```bash
npm run check
npm run build
```

Testing scope, current coverage, AI red-team controls, optional live
model evaluations, and known gaps are documented in
[`docs/testing.md`](docs/testing.md).

Sentia is an authenticated notebook editor with rich-text writing,
page organization, grounded AI assistance, and notebook-based quizzes.

## Stack

- Next.js 15 App Router and React 19
- TypeScript
- Supabase Auth and PostgreSQL
- Prisma ORM
- Tiptap rich-text editing
- OpenAI Responses and Embeddings APIs
- PostgreSQL `pgvector` retrieval
- Zustand editor state
- Tailwind CSS and CSS modules

## Local setup

1. Copy `.env.example` to `.env` and enter the project credentials.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Apply migrations and generate the Prisma client:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Required services

### Supabase

Configure email/password authentication and, if used, Google OAuth.
Add the server-only service-role key to enable self-service Auth user
deletion; never expose that key through a `NEXT_PUBLIC_` variable.
Google's authorized redirect URI must be:

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

### PostgreSQL

`DATABASE_URL` must point to the same PostgreSQL database used by the
application. The RAG migration enables the `vector` extension and
creates the `page_chunks` table.

For a serverless production host, use Supabase's transaction pooler
for the application's `DATABASE_URL`. Store the direct or session
connection separately as `DIRECT_DATABASE_URL`; the protected
database-migration workflow maps that secret to `DATABASE_URL` only
while it runs Prisma migrations.

### OpenAI

`OPENAI_API_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`.
The first AI request indexes changed notebook pages; later requests
reuse content hashes and only re-embed changed chunks.

## Validation

Run the complete local source validation:

```bash
npm run validate
```

Run a production compilation:

```bash
npm run build
```

The available scripts are:

- `npm run dev` — local development
- `npm run build` — optimized production build
- `npm run start` — serve the production build
- `npm run lint` — lint handwritten source
- `npm run typecheck` — strict TypeScript validation
- `npm run validate` — lint and typecheck
- `npm test` — deterministic route and library tests
- `npm run test:coverage` — tests with enforced coverage thresholds
- `npm run check` — lint, typecheck, and coverage-gated tests

## Project structure

```text
src/
├── app/                 Next.js pages and HTTP route handlers
├── components/          Reusable cross-feature UI
├── features/
│   ├── dashboard/       Dashboard components, models, and utilities
│   └── editor/          Editor components, models, and utilities
└── lib/
    ├── ai/              OpenAI, RAG, and Tiptap text processing
    ├── supabase/        Browser and server auth clients
    ├── apiSecurity.ts   Shared API validation and authorization
    └── prisma.ts        Database client lifecycle
```

See [docs/architecture.md](docs/architecture.md) for boundaries,
request flows, route ownership, and deployment checks.
See [docs/deployment-checklist.md](docs/deployment-checklist.md) for
the production environment, release, smoke-test, and rollback gates.

## Project

Sentia is designed and developed by
[Adrien Lawrence](https://www.linkedin.com/in/adrien-lawrence-b1483431b).
Source and additional projects are available on
[GitHub](https://github.com/AdrienLawrence).

## Deployment

Before deploying:

1. Set every variable from `.env.example` in the hosting environment.
   `DIRECT_DATABASE_URL` belongs in CI migration secrets, not in the
   running application.
2. Run the protected database migration workflow against the target
   database. Do not run production migrations from preview builds.
3. Confirm Supabase Site URL and OAuth redirect configuration.
4. Confirm custom SMTP delivery, confirmation, resend, and OAuth using
   the production domain.
5. Run `npm run check` and `npm run build`.
6. Confirm `/api/health` returns HTTP 200 without exposing secret
   values.
7. Verify the hosting environment uses a pooled runtime database
   connection and has database backups enabled.
8. Verify notebook CRUD, autosave, page undo, AI limits, and quiz
   generation against the production-target database.

Authenticated notebook and page reads use private ETag revalidation.
They must never be configured for shared CDN caching. Mutations, legal
consent checks, AI responses, and health responses remain uncached.

AI note content is sent to OpenAI only when an AI feature is invoked.
This behavior should be disclosed in the deployed privacy policy.
