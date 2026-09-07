import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: 'OAuth is not configured' },
      { status: 503 }
    )
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://sentia-nu.vercel.app'
      : new URL(request.url).origin)
  const resource = new URL('/api/mcp', appUrl).toString()

  return NextResponse.json(
    {
      resource,
      resource_name: 'Sentia Notes',
      authorization_servers: [
        `${supabaseUrl.replace(/\/$/, '')}/auth/v1`
      ],
      bearer_methods_supported: ['header'],
      resource_documentation: new URL(
        '/accessibility',
        appUrl
      ).toString()
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      }
    }
  )
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  })
}
