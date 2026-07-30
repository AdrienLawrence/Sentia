import { NextResponse } from 'next/server'

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
] as const

export async function GET() {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter(
    (name) => !process.env[name]?.trim()
  )
  const healthy = missing.length === 0

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'configuration_error',
      checks: {
        environment: healthy
      }
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  )
}
