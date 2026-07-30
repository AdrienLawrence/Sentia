import { NextResponse } from 'next/server'

export const PASSWORD_RECOVERY_COOKIE =
  'sentia-password-recovery'

const PASSWORD_RECOVERY_COOKIE_VALUE = 'verified'
const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 15 * 60

export function markPasswordRecoveryVerified(
  response: NextResponse
) {
  response.cookies.set(
    PASSWORD_RECOVERY_COOKIE,
    PASSWORD_RECOVERY_COOKIE_VALUE,
    {
      httpOnly: true,
      maxAge: PASSWORD_RECOVERY_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production'
    }
  )

  return response
}

export function hasVerifiedPasswordRecovery(request: Request) {
  const cookie = request.headers.get('cookie') ?? ''

  return cookie.split(';').some((part) => {
    const [name, ...valueParts] = part.trim().split('=')
    return (
      name === PASSWORD_RECOVERY_COOKIE &&
      valueParts.join('=') === PASSWORD_RECOVERY_COOKIE_VALUE
    )
  })
}

export function clearPasswordRecoveryMarker(
  response: NextResponse
) {
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  })

  return response
}
