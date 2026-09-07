# Sentia MCP integration

Sentia exposes a stateless remote MCP endpoint at:

```text
https://sentia-nu.vercel.app/api/mcp
```

The first supported client is Codex. The server deliberately exposes only:

- `list_notebooks`
- `list_pages`
- `read_page`
- `create_page`
- `append_to_page`
- `update_page`

It does not expose deletion, account operations, notebook reordering, or
Sentia's paid AI routes. `update_page` is marked destructive and replaces page
content only after an MCP client presents the operation for approval.

## Supabase configuration

1. Enable **Authentication → OAuth Server** in Supabase.
2. Configure the authorization path as `/oauth/consent`. Supabase combines
   this with the Authentication Site URL (`https://sentia-nu.vercel.app`).
3. Prefer an asymmetric Supabase JWT signing key before production use.
4. Register Codex as the first OAuth client using the redirect URI supplied by
   the Codex MCP connection flow.
5. Add that OAuth client's ID to the Vercel server-only environment variable
   `SENTIA_MCP_ALLOWED_CLIENT_IDS`.
6. Add the same public client ID as `NEXT_PUBLIC_SENTIA_MCP_CLIENT_ID` so the
   in-app setup instructions can provide the complete Codex commands.
7. Set `NEXT_PUBLIC_APP_URL=https://sentia-nu.vercel.app`.
8. Redeploy after changing Vercel environment variables.

Additional trusted client IDs can later be supplied as a comma-separated
allowlist. Do not enable arbitrary client registration until its abuse and
consent implications have been reviewed.

## Security model

- External clients authenticate with short-lived Supabase OAuth access tokens.
- Sentia validates each bearer token with Supabase and requires its `client_id`
  to be in the server-side allowlist.
- Every database operation is scoped to the authenticated Sentia user.
- Write tools require the latest notebook revision and fail rather than
  overwriting a newer browser or agent edit.
- Markdown inputs are size-limited and converted to validated Tiptap JSON.
- Whole-page replacement is explicitly marked destructive, remains bounded,
  and requires the latest revision so it cannot silently overwrite newer work.
- Existing account legal acceptance remains required.

## Maintenance mode

Set `MAINTENANCE_MODE=true` in Vercel and redeploy to return a static `503
Service Unavailable` screen. APIs and MCP return JSON `503` responses, while
`/api/health` remains available to monitoring systems. Set the value back to
`false` and redeploy to restore access.
