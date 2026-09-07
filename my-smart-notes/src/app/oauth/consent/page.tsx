'use client'

import { useEffect, useState } from 'react'

import { isSafeOAuthRedirect } from '@/features/integrations/lib/oauthRedirect'
import { createClient } from '@/lib/supabase/client'

type AuthorizationDetails = {
  authorization_id: string
  redirect_uri: string
  scope: string
  client: {
    id: string
    name: string
  }
  user: {
    email: string
  }
}

export default function OAuthConsentPage() {
  const [details, setDetails] =
    useState<AuthorizationDetails | null>(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let active = true

    const load = async () => {
      const authorizationId = new URLSearchParams(
        window.location.search
      ).get('authorization_id')

      if (!authorizationId) {
        setError('This authorization request is incomplete.')
        return
      }

      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        const returnPath = `${window.location.pathname}${window.location.search}`
        window.location.replace(
          `/login?next=${encodeURIComponent(returnPath)}`
        )
        return
      }

      const { data, error: requestError } =
        await supabase.auth.oauth.getAuthorizationDetails(
          authorizationId
        )

      if (!active) return

      if (requestError || !data) {
        setError(
          requestError?.message ??
            'This authorization request is invalid or expired.'
        )
        return
      }

      if ('redirect_url' in data) {
        if (!isSafeOAuthRedirect(data.redirect_url)) {
          setError('The authorization redirect was rejected.')
          return
        }

        window.location.assign(data.redirect_url)
        return
      }

      setDetails(data)
    }

    void load()
    return () => {
      active = false
    }
  }, [supabase])

  const decide = async (approved: boolean) => {
    if (!details || working) return

    setWorking(true)
    setError('')

    const response = approved
      ? await supabase.auth.oauth.approveAuthorization(
          details.authorization_id,
          { skipBrowserRedirect: true }
        )
      : await supabase.auth.oauth.denyAuthorization(
          details.authorization_id,
          { skipBrowserRedirect: true }
        )

    if (
      response.error ||
      !response.data ||
      !isSafeOAuthRedirect(response.data.redirect_url)
    ) {
      setError(
        response.error?.message ??
          'Sentia could not complete authorization.'
      )
      setWorking(false)
      return
    }

    window.location.assign(response.data.redirect_url)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080a0e] px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#11151c] p-7 text-slate-100">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-300">
          Sentia Integration
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Authorize notebook access
        </h1>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        ) : details ? (
          <>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              <strong className="text-slate-100">
                {details.client.name}
              </strong>{' '}
              is requesting access to the Sentia account for{' '}
              <span className="text-slate-200">
                {details.user.email}
              </span>
              .
            </p>

            <div className="mt-6 rounded-lg border border-slate-700 bg-[#0d1117] p-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                This integration can
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <li>• List your notebooks and page titles</li>
                <li>• Read page content as Markdown</li>
                <li>• Create pages in a notebook you select</li>
                <li>• Append formatted notes to an existing page</li>
                <li>• Replace and reformat a page after approval</li>
              </ul>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                It cannot delete notebooks or pages, access your
                account settings, or invoke Sentia AI. Replacing a
                page is marked destructive so the client can request
                confirmation. All writes use revision checks to avoid
                overwriting newer edits.
              </p>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                disabled={working}
                onClick={() => void decide(false)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Deny
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => void decide(true)}
                className="rounded-md border border-sky-700 bg-sky-900/50 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-800/60 disabled:opacity-50"
              >
                {working ? 'Authorizing…' : 'Authorize'}
              </button>
            </div>
          </>
        ) : (
          <p role="status" className="mt-5 text-sm text-slate-400">
            Loading authorization request…
          </p>
        )}
      </section>
    </main>
  )
}
