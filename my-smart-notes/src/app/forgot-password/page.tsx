'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('recovery') === 'failed') {
      setError(
        'That password recovery link is invalid or expired. Request a new one.'
      )
      window.history.replaceState({}, '', '/forgot-password')
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSending(true)

    try {
      const response = await fetch('/api/account/recovery/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          website
        })
      })
      const result = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null

      if (!response.ok) {
        throw new Error(
          result?.error || 'A recovery link could not be requested.'
        )
      }

      setNotice(
        result?.message ||
          'If that address has a password account, a recovery link has been sent.'
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'A recovery link could not be requested.'
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#080a0e] flex items-center justify-center px-6 py-10">
      <section className="max-w-md w-full rounded-xl border border-slate-800 bg-[#0d1117] p-8 shadow-2xl shadow-black/30">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-50">
            Reset your password
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            Enter the email address connected to your Sentia account.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-900/70 bg-red-950/50 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="sentia-auth-notice mb-6 rounded-lg border border-sky-900/70 bg-sky-950/40 px-4 py-3 text-sm text-sky-200"
          >
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-slate-500"
              placeholder="you@example.com"
            />
          </label>

          <div
            aria-hidden="true"
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
          >
            <label>
              Website
              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 font-medium text-slate-50 transition-colors hover:bg-slate-600 disabled:cursor-wait disabled:border-slate-800 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isSending ? 'Sending link…' : 'Send recovery link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-200"
          >
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  )
}
