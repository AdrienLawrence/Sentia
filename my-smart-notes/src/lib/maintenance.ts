import { NextResponse, type NextRequest } from 'next/server'

const MAINTENANCE_RETRY_SECONDS = 300

export function isMaintenanceModeEnabled() {
  return ['1', 'true', 'on'].includes(
    (process.env.MAINTENANCE_MODE ?? '').trim().toLowerCase()
  )
}

export function isMaintenanceExemptPath(pathname: string) {
  return pathname === '/api/health'
}

export function maintenanceResponse(request: NextRequest) {
  const headers = {
    'Cache-Control': 'no-store, max-age=0',
    'Retry-After': String(MAINTENANCE_RETRY_SECONDS),
    'X-Robots-Tag': 'noindex, nofollow, noarchive'
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'Sentia is temporarily unavailable for maintenance.',
        retryAfterSeconds: MAINTENANCE_RETRY_SECONDS
      },
      { status: 503, headers }
    )
  }

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <title>Sentia is undergoing maintenance</title>
    <style>
      :root { color-scheme: dark; font-family: Arial, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #080a0e; color: #f8fafc; }
      main { width: min(520px, 100%); border: 1px solid #334155; border-radius: 12px; background: #11151c; padding: 34px; }
      .mark { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid #3977ad; border-radius: 10px; background: #10263b; color: #a9d5fb; font: 700 27px Georgia, serif; }
      .label { margin: 22px 0 0; color: #7dd3fc; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: 10px 0 0; font-size: clamp(26px, 6vw, 38px); line-height: 1.08; letter-spacing: -.03em; }
      p { margin: 16px 0 0; color: #94a3b8; font-size: 15px; line-height: 1.7; }
      a { display: inline-block; margin-top: 26px; border: 1px solid #475569; border-radius: 7px; background: #1e293b; color: #f8fafc; padding: 10px 15px; text-decoration: none; }
      a:hover { background: #334155; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">S</div>
      <p class="label">Scheduled maintenance</p>
      <h1>Sentia will be back shortly.</h1>
      <p>We are applying an update and have temporarily paused access to protect your notes. Your stored notebooks are not affected.</p>
      <a href="">Try again</a>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  )
}
