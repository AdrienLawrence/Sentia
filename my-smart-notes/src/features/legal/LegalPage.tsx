import Link from 'next/link'

import {
  LegalDocumentContent,
  type LegalDocumentType
} from './policyContent'

export function LegalPage({
  document
}: {
  document: LegalDocumentType
}) {
  return (
    <div className="min-h-screen bg-[#080a0e] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0b0e13]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-semibold tracking-tight text-slate-100 hover:text-white"
          >
            Sentia
          </Link>
          <nav
            aria-label="Legal documents"
            className="flex gap-4 text-sm"
          >
            <Link
              href="/privacy"
              aria-current={
                document === 'privacy' ? 'page' : undefined
              }
              className="text-slate-400 hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              aria-current={document === 'terms' ? 'page' : undefined}
              className="text-slate-400 hover:text-white"
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <LegalDocumentContent document={document} />
      </main>
    </div>
  )
}

