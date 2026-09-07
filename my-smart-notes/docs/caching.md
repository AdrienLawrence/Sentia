# Sentia caching audit

Last reviewed: September 2, 2026

This document records the caches currently used by Sentia. It is an audit,
not a proposal to add Redis or broadly cache authenticated content.

| Area | Location | Stored data | Lifetime / eviction | Invalidation | Scaling notes |
| --- | --- | --- | --- | --- | --- |
| Dashboard notebooks | `src/features/dashboard/lib/notebookSessionCache.ts` | Notebook metadata and the response ETag, keyed by authenticated user | Browser `sessionStorage`; lasts for the tab session; malformed/version-mismatched entries are removed | Updated after dashboard mutations and cleared on sign-out/account deletion | Fast return navigation in one tab. No cross-tab invalidation and no explicit age limit. |
| Conditional API responses | `src/lib/httpCache.ts` | No server-side payload cache; computes a private ETag from each response | One HTTP revalidation | Client sends `If-None-Match`; server returns `304` when unchanged | Saves transfer and client JSON parsing, but the database query and serialization still happen before comparison. |
| Editor page content | `src/features/editor/hooks/useEditorSession.ts` | Page directory and hydrated page content | React memory for the mounted editor session | Updated by editor mutations; discarded when the editor unmounts | Loads the active page first, then hydrates batches in the background with in-flight deduplication. |
| Legal consent | `src/lib/apiSecurity.ts` and `src/features/legal/LegalConsentGate.tsx` | Current legal-version acceptance | Server-process memory: 15 minutes for accepted, 30 seconds for unaccepted; browser session marker | Updated after acceptance; naturally expires | Safe but instance-local. A serverless cold start or different instance queries the database again. |
| RAG embeddings | `src/lib/ai/rag.ts` and `page_chunks` | Persistent text chunks, SHA-256 content hashes, and embeddings | Until page content changes or its page/notebook/account is deleted | On AI invocation, hashes are compared and changed chunks are replaced | Avoids repeat embedding cost. Each invocation still loads and hashes notebook content, and simultaneous cold requests can duplicate embedding work. |
| Local Markdown mirror | `src/features/local-mirror/lib/localMarkdownMirror.ts` | Browser-held directory handle, manifest, and page hashes | Browser IndexedDB plus files on the user device | Manifest changes on sync; unchanged hashes skip disk writes | Device-local only; it is not a shared server cache. |
| API read-rate counters | `src/lib/apiSecurity.ts` | Short request counters | Server-process memory for each rate window | Expired entries are pruned opportunistically | Fast but instance-local. Write and sensitive limits use the database instead. |

## Current conclusions

- Authenticated responses are not stored in a shared public cache.
- Sentia has no Redis, Memcached, Next.js data cache, or cache-tag layer.
- The current ETag implementation is primarily a bandwidth optimization, not
  a database-latency optimization.
- The editor's progressive hydration is appropriate for current notebook
  sizes, but should be measured before raising limits or preloading more data.
- RAG content hashes are the most valuable persistent cache because they
  prevent unnecessary paid embedding calls.

## Measured next steps

Do not introduce a shared cache until production tracing identifies a repeated
query whose latency or volume justifies it. Likely future candidates are:

1. Add a short dashboard cache age and `BroadcastChannel` invalidation if
   cross-tab staleness is observed.
2. Add per-page dirty state or a distributed single-flight lock if concurrent
   RAG indexing duplicates paid embedding requests.
3. Move legal-consent caching to a shared store only if database checks remain
   a material portion of authenticated request latency.
4. Cap background editor hydration for extremely large notebooks after real
   notebook-size and traversal metrics are available.

Any future shared cache must include the authenticated user ID in its key,
use bounded TTLs, and invalidate on every relevant mutation.
