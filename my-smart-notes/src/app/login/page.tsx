'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LEGAL_CONSENT_SESSION_KEY
} from '@/features/legal/constants'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    sessionStorage.removeItem(LEGAL_CONSENT_SESSION_KEY)
    const searchParams = new URLSearchParams(window.location.search)

    if (searchParams.get('oauth') === 'failed') {
      setError('Google sign-in could not be completed. Please try again.')
      window.history.replaceState({}, '', '/login')
    } else if (searchParams.get('confirmation') === 'failed') {
      setError(
        'That confirmation link is invalid or expired. Enter your email and request a new one below.'
      )
      window.history.replaceState({}, '', '/login')
    }
  }, [])

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    setNotice('')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })

      if (error) throw error
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : 'Google sign-in could not be started.'
      )
      setGoogleLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim()

    setError('')
    setNotice('')

    if (!normalizedEmail) {
      setError('Enter your email address before requesting a new link.')
      return
    }

    setResendLoading(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      })

      if (error) throw error

      setNotice(
        'If that address has an unconfirmed account, a new confirmation link has been sent.'
      )
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : 'A new confirmation link could not be sent.'
      )
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    // Password confirmation check
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Password length check
    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`
          }
        })
        if (error) throw error

        if (!data.session) {
          setNotice(
            'Check your email to confirm your account. You can request a new link below if it expires.'
          )
          return
        }
      }
      
      router.push('/dashboard')
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : 'Authentication could not be completed.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080a0e] flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#0d1117] p-8 shadow-2xl shadow-black/30">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 mb-2">
            {isLogin ? 'Welcome Back' : 'Join Sentia'}
          </h1>
          <p className="text-slate-500">
            {isLogin ? 'Ready to jump back in?' : 'Create your account to get started'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-900/70 bg-red-950/50 px-4 py-3 text-sm text-red-300">
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

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={
            loading ||
            googleLoading ||
            resendLoading
          }
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
          >
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.55l3.35-2.62Z" />
            <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
          </svg>
          {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
        </button>

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs uppercase tracking-wider text-slate-600">or</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {/* Login/Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-slate-500"
              required
            />
          </div>

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className="w-full rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 pr-12 text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-slate-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? 'hide' : 'show'}
            </button>
          </div>

          {/* Confirm Password (Signup only) */}
          {!isLogin && (
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-700 bg-[#11151c] px-4 py-3 pr-12 text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-slate-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
              >
                {showConfirmPassword ? 'hide' : 'show'}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              googleLoading ||
              resendLoading
            }
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 font-medium text-slate-50 shadow-sm transition-colors cursor-pointer hover:bg-slate-600 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {isLogin && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              disabled={
                loading ||
                googleLoading ||
                resendLoading
              }
              className="text-sm text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Toggle between login/signup */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
              setNotice('')
              setConfirmPassword('')
            }}
            className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => void handleResendConfirmation()}
            disabled={
              loading ||
              googleLoading ||
              resendLoading
            }
            className="text-sm text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendLoading
              ? 'Sending confirmation link…'
              : 'Resend confirmation email'}
          </button>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          By continuing, you will be asked to review Sentia&apos;s{' '}
          <a
            href="/privacy"
            className="text-slate-400 underline hover:text-slate-200"
          >
            Privacy Policy
          </a>{' '}
          and{' '}
          <a
            href="/terms"
            className="text-slate-400 underline hover:text-slate-200"
          >
            Terms of Service
          </a>
          .
        </p>
      </div>
    </div>
  )
}
