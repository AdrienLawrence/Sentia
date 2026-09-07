'use client'

import { useEffect, useState } from 'react'

type McpIntegrationSettingsProps = {
  className?: string
}

export function McpIntegrationSettings({
  className = ''
}: McpIntegrationSettingsProps) {
  const [endpoint, setEndpoint] = useState('/api/mcp')
  const [copied, setCopied] = useState(false)
  const clientId =
    process.env.NEXT_PUBLIC_SENTIA_MCP_CLIENT_ID?.trim() ?? ''
  const setupCommands = clientId
    ? [
        `codex mcp add sentia --url ${endpoint} --oauth-client-id ${clientId}`,
        'codex mcp login sentia'
      ].join('\n')
    : ''

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/mcp`)
  }, [])

  const copyEndpoint = async () => {
    if (!setupCommands) return

    try {
      await navigator.clipboard.writeText(setupCommands)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={`${className} py-5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Agent Integrations
        </h3>
        <span className="rounded border border-sky-900/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sky-300">
          MCP
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-slate-200">
        Connect Codex to your notes
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Run these commands in a terminal. Sentia will open a browser
        approval screen before the agent can read or append formatted
        notebook content.
      </p>

      <div className="mt-4 flex gap-2">
        <textarea
          aria-label="Sentia Codex MCP setup commands"
          value={
            setupCommands ||
            'MCP setup is not configured for this deployment.'
          }
          readOnly
          rows={3}
          className="min-w-0 flex-1 resize-none rounded-md border border-slate-700 bg-[#0d1117] px-3 py-2 font-mono text-xs leading-5 text-slate-300 outline-none"
        />
        <button
          type="button"
          onClick={() => void copyEndpoint()}
          disabled={!setupCommands}
          className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? 'Copied' : 'Copy setup'}
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Available tools can list notebooks and pages, read a page,
        create a page, append Markdown, and replace a page after
        explicit approval. Deletion is not exposed.
      </p>
    </section>
  )
}
