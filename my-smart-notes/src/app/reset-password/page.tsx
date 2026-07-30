'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    let active = true

    const checkRecoverySession = async () => {
      try {
        const response = await fetch('/api/account/recovery', {
          cache: 'no-store'
        })
        if (!active) return
        setHasRecoverySession(response.ok)
      } catch {
        if (!active) return
        setHasRecoverySession(false)
      } finally {
        if (active) setIsCheckingSession(false)
      }
    }

    void checkRecoverySession()

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/account/recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          result?.error || 'Your password could not be updated.'
        )
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (updateError: unknown) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Your password could not be updated.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080a0e] px-6 py-10 text-slate-100">
      <main className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0d1117] p-8 shadow-2xl shadow-black/30">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use at least eight characters and avoid reusing a password
          from another account.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-900/70 bg-red-950/50 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {isCheckingSession ? (
          <p className="mt-7 text-sm text-slate-400">
            Verifying your recovery link…
          </p>
        ) : hasRecoverySession ? (
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 pr-14 text-slate-100 outline-none transition-colors focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 hover:text-slate-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-new-password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Confirm new password
              </label>
              <input
                id="confirm-new-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(event.target.value)
                }
                minLength={8}
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 font-medium text-slate-50 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        ) : (
          <div className="mt-7">
            <p className="text-sm leading-6 text-slate-300">
              This recovery link is invalid or expired. Request a new
              one from the sign-in page.
            </p>
            <Link
              href="/forgot-password?recovery=failed"
              className="mt-5 inline-flex rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Return to sign in
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
