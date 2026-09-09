# Sentia testing strategy

Sentia uses a deterministic automated suite for API behavior,
authorization boundaries, document validation, RAG indexing, and AI
safety contracts. The default suite does not open a browser, connect
to Supabase, mutate a database, or send requests to OpenAI.

## Commands

| Command | Purpose | External effects |
| --- | --- | --- |
| `npm test` | Run the deterministic test suite | None |
| `npm run test:coverage` | Run tests and enforce backend coverage thresholds | None |
| `npm run validate` | Run ESLint and TypeScript checking | None |
| `npm run check` | Run validation and coverage-gated tests | None |
| `npm run build` | Produce a production Next.js build | May download configured Google Fonts when they are not cached |
| `npm run test:ai:live` | Run opt-in live model safety evaluations | Sends synthetic prompts to OpenAI and may incur charges |

The live AI command is intentionally disabled unless
`RUN_LIVE_AI_TESTS=1` and `OPENAI_API_KEY` are present. On PowerShell:

```powershell
$env:RUN_LIVE_AI_TESTS='1'
npm run test:ai:live
```

Live evaluations are not part of the normal green build because model
behavior is probabilistic, network-dependent, and billable.

## Current deterministic baseline

As of July 29, 2026:

- 98 tests pass across 22 suites.
- 17 suites pass.
- Covered modules report 84.11% line coverage.
- Covered modules report 69.97% branch coverage.
- Covered modules report 87.55% function coverage.
- Enforced minimums are 80% lines, 60% branches, and 80% functions.

These are scoped backend figures for modules loaded by the automated
suite. They are not represented as whole-application UI coverage.

## Coverage matrix

| Area | Automated assertions |
| --- | --- |
| Authentication | Missing users are rejected through verified Supabase JWT claims |
| Account lifecycle | Email confirmation, both recovery-link formats, recovery-only password changes, typed account-deletion confirmation, application-data cleanup, Auth identity deletion, stale-token resurrection protection, and partial-failure reporting |
| Same-origin security | Cross-origin mutations fail before database work |
| Rate limiting | Durable mutation counters reject excess requests; ordinary reads avoid database counter writes |
| Notebook lifecycle | User-scoped list, create defaults, load, rename, delete, and unowned rejection |
| Page lifecycle | User-scoped list/load, sequential creation, content update, deletion, ordering, and foreign-ID rejection |
| Drawings | Owned page/draw-box creation, validation, load, update, delete, and unowned rejection |
| Feedback | User-scoped history and opt-in diagnostic-context persistence |
| Legal consent | Current-version checks, bounded accepted-state reuse, affirmative dual acceptance, and partial-acceptance rejection |
| Tiptap security | Unsafe event fields, unsafe URLs, extraction, chunking, and deterministic hashing |
| RAG | Notebook ownership, unchanged-hash reuse, changed-page re-embedding, and user/notebook retrieval scoping |
| Ask AI | Request validation, history-role restrictions, external-research routing, moderation-before-indexing, and source boundaries |
| Quiz AI | Structured source boundaries, source-number validation path, and moderated-output rejection |
| OpenAI client | No-store requests, integrated input/output moderation, standalone moderation, and pseudonymous safety identifiers |
| Prompt injection | JSON boundary tests for forged roles, delimiter injection, source instructions, and prompt-disclosure attempts |
| Local Markdown mirror | Stable ownership metadata, safe filenames, managed rename/delete behavior, and protection against overwriting colliding unmanaged files |
| Concurrent editing | Notebook revision compare-and-swap, stale-write rejection, cancelled mirror work, and unchanged-file suppression |

## Test architecture

The suite uses the Node.js 24 built-in test runner. This avoids adding
a test-framework dependency solely for backend route tests.

`tests/register-hooks.mjs` maps the application's `@/` alias and
substitutes deterministic test doubles for Prisma, Supabase, RAG, and
OpenAI at module boundaries. Route handlers are then called directly
with real `Request` objects. Assertions inspect status codes, response
bodies, ownership filters, and attempted persistence.

Each test file runs in an isolated Node test process. The mock state is
reset before every test, and test concurrency is intentionally set to
one to keep recorded calls deterministic.

## AI defense in depth

The AI boundary does not rely on one prompt sentence:

1. API routes validate action names, target names, history roles,
   lengths, UUIDs, ownership, origin, authentication, and rate limits.
2. User instructions receive a standalone moderation check before RAG
   indexing or response generation.
3. User questions, history, page content, and retrieved chunks are
   serialized as values in a server-created JSON object.
4. Developer instructions explicitly classify every JSON value as
   untrusted data and reject instructions embedded in those values.
5. Responses API calls request input and output moderation.
6. Flagged input or output is not returned to the user.
7. Requests include a stable SHA-256 safety identifier derived from
   the internal user ID, rather than sending the raw identifier.
8. Response storage is disabled with `store: false`.
9. Deterministic adversarial tests prevent the boundary from being
   accidentally removed during later refactors.
10. Optional live evaluations probe actual model behavior without
    making paid, probabilistic calls part of every build.

A directive wrapper reduces prompt-injection risk but cannot prove a
model is immune to every jailbreak. Moderation detects policy-relevant
harm; it is not a general prompt-injection detector. The structured
boundary, authorization controls, red-team cases, output review, and
provider safeguards remain separate layers.

## What the deterministic suite does not prove

- Mocked Prisma tests do not prove that a deployed database has applied
  every migration or foreign-key cascade.
- Mocked Supabase tests do not prove that production OAuth redirect
  URLs, provider settings, or cookie settings are correct.
- Deterministic AI tests prove request construction and failure
  handling, not that every future model response will be safe or
  factually correct.
- There is not yet automated browser coverage for responsive layout,
  caret placement, drag-and-drop, keyboard navigation, modal focus,
  screen-reader announcements, or visual regressions.
- There is not yet an isolated disposable-database integration suite.
- The application currently permits users aged 13 and older. Serving
  minors with AI requires a separate product and legal review of age
  assurance, monitoring, escalation, disclosures, and provider data
  controls; this test suite does not certify that compliance.

These limitations should remain visible rather than being hidden
behind an inaccurate “fully tested” claim.

## Recommended future layers

1. Add a disposable PostgreSQL/pgvector database in CI and apply all
   Prisma migrations before integration tests.
2. Add browser automation for the highest-risk editor workflows:
   autosave, optimistic page creation, deletion/undo, reordering,
   imports/exports, legal scroll gating, and stale-tab behavior.
3. Maintain a versioned AI evaluation dataset containing benign,
   ambiguous, adversarial, and policy-sensitive prompts.
4. Record live-evaluation model version, date, pass rate, latency, and
   failure examples without storing real user notebook content.
5. Re-run accessibility tooling and keyboard checks against the
   deployed build.

## Recruiter-facing evidence

A reviewer can clone the project and run:

```bash
npm ci
npm run check
npm run build
```

The useful engineering evidence is not merely the test count. It is
the documented distinction between unit/route tests, mocked external
boundaries, coverage thresholds, opt-in paid AI evaluations, and
known gaps.
