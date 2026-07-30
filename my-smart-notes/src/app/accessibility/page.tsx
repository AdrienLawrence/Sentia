import type { Metadata } from 'next'
import Link from 'next/link'

import { LEGAL_CONTACT_EMAIL } from '@/features/legal/constants'

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'Sentia accessibility statement'
}

export default function AccessibilityPage() {
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
          <nav aria-label="Information pages" className="flex gap-4 text-sm">
            <Link
              href="/accessibility"
              aria-current="page"
              className="text-slate-200 hover:text-white"
            >
              Accessibility
            </Link>
            <Link
              href="/privacy"
              className="text-slate-400 hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-slate-400 hover:text-white"
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <article className="rounded-xl border border-slate-800 bg-[#11151c] p-6 shadow-xl shadow-black/10 sm:p-9">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Last updated July 29, 2026
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Accessibility statement
          </h1>
          <p className="mt-5 leading-7 text-slate-300">
            Sentia is intended to support different ways of navigating,
            reading, and creating notes. The project is working toward
            conformance with the Web Content Accessibility Guidelines
            (WCAG) 2.2 Level AA. This statement does not claim that Sentia
            has completed an independent accessibility certification.
          </p>

          <section className="mt-9">
            <h2 className="text-xl font-semibold text-slate-100">
              Current accessibility support
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-300">
              <li>Keyboard commands for core editor navigation and page reordering.</li>
              <li>Visible labels and accessible names for primary controls.</li>
              <li>Keyboard-aware menus and modal dialogs.</li>
              <li>Status announcements for selected editor operations.</li>
              <li>Light and dark application themes.</li>
            </ul>
          </section>

          <section className="mt-9">
            <h2 className="text-xl font-semibold text-slate-100">
              Known limitations
            </h2>
            <p className="mt-4 leading-7 text-slate-300">
              Sentia has not yet completed comprehensive testing with every
              browser, screen reader, assistive technology, or input method.
              Rich-text editing, drag-and-drop interactions, imported
              documents, and AI-generated content may present additional
              accessibility challenges. These areas remain part of the
              project&apos;s pre-launch accessibility review.
            </p>
          </section>

          <section className="mt-9">
            <h2 className="text-xl font-semibold text-slate-100">
              Report an accessibility problem
            </h2>
            <p className="mt-4 leading-7 text-slate-300">
              If you encounter a barrier, email{' '}
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="font-medium text-slate-200 underline decoration-slate-600 underline-offset-4 hover:text-white"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
              . Include the page or feature involved, what you were trying to
              do, and the browser or assistive technology you used when
              relevant. Do not include passwords or unnecessary sensitive
              information.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
