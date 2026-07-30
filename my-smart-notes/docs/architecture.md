# Sentia architecture

## Boundaries

`src/app` owns routing and route-level orchestration. Reusable UI,
models, and feature-specific presentation live under `src/features`.
Cross-feature infrastructure lives under `src/lib`.

The editor route is a thin App Router entry point. The feature
workspace composes focused hooks for session loading and autosave,
optimistic navigation, title persistence, page reordering, deferred
deletion, AI state, preferences, and exit synchronization.
Presentation surfaces are isolated under
`src/features/editor/components`.

Editor responsibilities are divided as follows:

| Module | Responsibility |
| --- | --- |
| `useEditorSession` | Initial loading, active page state, page collection, and debounced content persistence |
| `usePageNavigation` | Previous/next navigation and optimistic page creation |
| `useDeferredPageDeletion` | LIFO undo stack and exit-time deletion synchronization |
| `usePageReordering` | Read-mode drag state and persisted ordering |
| `useEditorTitles` | Page-title and notebook-name persistence |
| `useAiAssistant` | AI conversation, requests, selections, insertion, and replacement |
| `useEditorPreferences` | Paper theme, tutorial state, and font-size input state |
| `EditorSidebar` | Notebook, mode, formatting, and page-list presentation |
| `EditorDocument` | Paper, title, Tiptap surface, and page arrows |

The dashboard route owns authentication and notebook mutations.
Dashboard preferences, models, formatting helpers, and modal
presentation are isolated under `src/features/dashboard`.

## Browser routes

| Route | Responsibility |
| --- | --- |
| `/` | Product landing page |
| `/login` | Email/password and Google authentication |
| `/reset-password` | Recovery-session password update |
| `/dashboard` | Notebook discovery and management |
| `/editor/[id]` | Page editing and notebook AI assistant |
| `/quiz` | Notebook selection for a study quiz |
| `/quiz/[notebookId]` | Source-grounded notebook quiz |
| `/accessibility` | Public accessibility statement and issue-reporting contact |
| `/privacy` | Public Privacy Policy |
| `/terms` | Public Terms of Service |
| `/auth/callback` | Supabase OAuth code exchange |
| `/auth/confirm` | Email confirmation token verification |

## API routes

| Route | Methods | Ownership boundary |
| --- | --- | --- |
| `/api/health` | GET | Non-secret configuration readiness |
| `/api/account` | DELETE | Authenticated self-service account deletion |
| `/api/account/recovery` | GET, POST | Verified recovery-session validation and password update |
| `/api/legal-consent` | GET, POST | Authenticated user's versioned acceptance |
| `/api/notebooks` | GET, POST | Authenticated user's notebooks |
| `/api/notebooks/[id]` | GET, PATCH, DELETE | Owned notebook |
| `/api/notebooks/[id]/latest-page` | GET | Owned notebook |
| `/api/notebooks/[id]/pages` | GET, POST, PATCH | Owned notebook pages and order |
| `/api/pages/[id]` | GET, PATCH, DELETE | Owned page |
| `/api/feedback` | GET, POST | Authenticated user's feedback |
| `/api/ai/ask` | POST | Owned page and notebook |
| `/api/ai/quiz` | POST | Owned notebook |
| `/api/draw-boxes` | POST | Owned page |
| `/api/draw-elements` | POST | Draw box under an owned page |
| `/api/draw-elements/[id]` | GET, PATCH, DELETE | Element under an owned page |

All mutations pass through the shared validation, same-origin,
authentication, ownership, and rate-limit helpers in
`src/lib/apiSecurity.ts`.

## Editor persistence

Content and notebook names use a short debounce. Pending content is
flushed before page navigation and AI actions. Page creation is
optimistic and reconciles the temporary client page with the returned
database record without resetting the editor caret.

Page deletion is deferred in a LIFO undo stack. Remaining deletions
are sent when the editor session exits.

Editor initialization loads the requested page first so editing can
begin before it requests the metadata-only page directory and starts
bounded background content batches.
Page navigation reuses a shared in-flight request when content is
already loading and immediately requests a cold page when it is not.
Page IDs, rather than current positions, identify queued work so
optimistic reordering cannot associate content with the wrong page.
Bulk export explicitly requests complete notebook content, while the
local Markdown mirror waits until every page has been hydrated.

The dashboard stores notebook metadata in user-scoped session storage
and renders it after reading the local Supabase session. It then
revalidates with the server using the cached ETag. Opening a notebook
uses the cached latest-page ID without a separate navigation request
and updates only that notebook's cached activity timestamp; logout
removes the user-scoped cache.

Server authorization verifies Supabase JWT claims against the
project's asymmetric signing key rather than performing a remote Auth
user lookup for every request. Ordinary authenticated reads use a
process-local short-window limiter and do not write rate-limit rows.
Durable database counters remain on mutations and billable AI paths.
Current legal-document acceptance is cached by user and exact policy
versions for a bounded period; changing either version creates a new
cache key and requires database verification again.

## AI and retrieval

AI routes authenticate the user and reload the referenced page and
notebook from the database. Notebook pages are converted from Tiptap
JSON into bounded text chunks. SHA-256 hashes prevent unchanged
chunks from being re-embedded. Retrieval uses pgvector cosine
distance scoped to both user and notebook.

General assistant requests cost one daily credit. Quiz generation
costs five. Each user receives 30 credits in a rolling 24-hour window,
in addition to the short-window AI request limit.

AI prompts use a server-created JSON boundary for page content,
conversation history, questions, and retrieved sources. Developer
instructions treat every JSON value as untrusted data. User
instructions are moderated before indexing, generated inputs and
outputs request provider moderation, and flagged content is not
returned. Responses use pseudonymous safety identifiers and request
`store: false`.

## Database lifecycle

Supabase owns authentication identities. API routes upsert the
corresponding application `User` record before creating user-owned
data. Notebook, page, chunk, feedback, and drawing relationships are
enforced through Prisma and database foreign keys. Dependent records
use cascading deletes where appropriate.

Self-service account deletion removes the application user and
cascading data before deleting the Supabase Auth identity. A one-way
hash of the deleted Auth identifier is retained for 24 hours so a
previously issued access token cannot recreate the application user
through legal onboarding. Normal notebook and page requests do not
perform this tombstone lookup.

Production deployments must run:

```bash
npx prisma migrate deploy
npx prisma generate
```

Do not use `prisma db push` as the production deployment workflow.

The running application should use Supabase's pooled database
connection. The protected migration job receives the direct database
connection as `DIRECT_DATABASE_URL` and exposes it to Prisma as
`DATABASE_URL` only for the duration of `prisma migrate deploy`.

## HTTP caching

API responses are uncached by default. Authenticated notebook and page
GET routes opt into browser-private conditional revalidation using a
user-scoped ETag. A matching `If-None-Match` request returns HTTP 304.
The response remains `private` and requires revalidation, so notebook
content cannot enter a shared CDN cache and mutations are observed on
the next read.

AI responses, legal-consent state, mutations, and health responses use
`no-store`. RAG embeddings have a separate content-hash cache in
PostgreSQL.

## Deployment automation

Pull requests and branch updates run locked dependency installation,
Prisma client generation, the complete test and validation suite, and
a production build. npm downloads and Next.js compilation artifacts
are cached by content-derived keys.

Production database migrations are a separate manual workflow bound to
the protected `production` GitHub environment. Configure environment
reviewers and a `DIRECT_DATABASE_URL` secret before using it. Preview
deployments must not run migrations against the production database.

## Automated testing

The dependency-free Node test suite calls route handlers directly with
mocked Prisma, Supabase, RAG, and OpenAI boundaries. It covers core
resource lifecycle, ownership, validation, rate limiting, RAG cache
behavior, prompt-injection boundaries, moderation, and provider
request controls.

See [`docs/testing.md`](testing.md) for commands, coverage thresholds,
the route matrix, optional live AI evaluations, and explicitly
documented limitations.
