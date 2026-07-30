# Sentia deployment checklist

This checklist separates automated repository checks from external
production controls. A successful build is necessary but is not, by
itself, approval to launch publicly.

## Repository gate

- [ ] Review and commit the complete working tree.
- [ ] `npm ci` succeeds from the committed lockfile.
- [ ] `npx prisma validate` succeeds.
- [ ] `npx prisma generate` succeeds.
- [ ] `npm run check` succeeds.
- [ ] `npm run build` succeeds.
- [ ] The GitHub CI workflow succeeds on the release commit.

## GitHub environment

- [ ] Create a protected GitHub environment named `production`.
- [ ] Require a reviewer for the production environment.
- [ ] Add `DIRECT_DATABASE_URL` only to that environment.
- [ ] Keep workflow permissions at read-only unless a later deployment
      integration requires a narrowly scoped additional permission.
- [ ] Do not expose production secrets to pull-request workflows.

## Hosting environment

- [ ] Configure `DATABASE_URL` with Supabase's pooled runtime
      connection.
- [ ] Configure `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Configure `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Configure server-only `SUPABASE_SERVICE_ROLE_KEY` for account
      deletion.
- [ ] Configure server-only `OPENAI_API_KEY`.
- [ ] Configure optional OpenAI model overrides only when deliberately
      changing the tested defaults.
- [ ] Confirm `/api/health` returns HTTP 200.
- [ ] Confirm HTTPS and every security response header on the deployed
      domain.

## Supabase

- [ ] Set the production Site URL.
- [ ] Allow only the intended production and local-development redirect
      URLs.
- [ ] Verify email confirmation and resend flows on the production
      domain.
- [ ] Verify password recovery and expired-link handling on the
      production domain.
- [ ] Verify Google OAuth with an account outside the developer account.
- [ ] Configure custom SMTP and monitor bounce or delivery failures.
- [ ] Enable database backups and record the restoration procedure.
- [ ] Run the protected production migration workflow once.
- [ ] Verify the migration history includes legal consent, RAG,
      notebook revision, and query indexes.

## OpenAI

- [ ] Set a project-level monthly budget and alert thresholds.
- [ ] Confirm the API key is restricted to the intended project.
- [ ] Confirm request and daily application limits return controlled
      HTTP 429 responses.
- [ ] Run the opt-in live AI safety evaluation against the production
      model configuration before launch.

## Release smoke test

- [ ] Create and confirm a new email account.
- [ ] Sign in with email and Google.
- [ ] Accept both legal documents and revisit them from Settings.
- [ ] Create, rename, search, open, and delete a notebook.
- [ ] Recover an email/password account through the production email
      link.
- [ ] Create, rename, reorder, edit, undo-delete, and restore pages.
- [ ] Open the same notebook in two tabs and verify the stale tab is
      forced to refresh before editing.
- [ ] Import and export each supported file format.
- [ ] Connect and disconnect the optional local Markdown mirror.
- [ ] Generate an AI answer and a quiz.
- [ ] Confirm another account cannot access the first account's IDs.
- [ ] Delete a disposable account and confirm it can no longer sign in
      or access its former data.
- [ ] Confirm narrow and mobile layouts remain usable by keyboard.

## Caching checks

- [ ] Notebook and page GET responses are `private` and include an
      `ETag`.
- [ ] Revalidation with `If-None-Match` returns HTTP 304.
- [ ] API mutations, AI, legal consent, and health use `no-store`.
- [ ] No authenticated notebook response is cached by a shared CDN.

## Rollback

- [ ] Preserve the previously deployed application version.
- [ ] Record the release commit and migration run.
- [ ] Use application rollback for code regressions.
- [ ] Prefer a forward corrective migration for database regressions;
      do not automatically reverse a migration that may contain user
      data.
- [ ] Re-run the health check and smoke test after rollback.

## Public-launch gates not proven by CI

- [ ] Complete a real browser-based accessibility audit.
- [ ] Complete an authenticated staging integration test against
      disposable Supabase resources.
- [ ] Complete a production dependency advisory audit.
- [ ] Configure production error monitoring and alert routing.
- [ ] Have the Privacy Policy and Terms reviewed for the launch
      jurisdiction and intended age range.
