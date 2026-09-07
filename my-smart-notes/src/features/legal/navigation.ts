const PROTECTED_DESTINATIONS = ['/dashboard', '/editor', '/quiz']

export function safeLegalReturnPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  try {
    const url = new URL(value, 'https://sentia.local')
    const isProtectedDestination = PROTECTED_DESTINATIONS.some(
      (prefix) =>
        url.pathname === prefix ||
        url.pathname.startsWith(`${prefix}/`)
    )

    if (
      url.origin !== 'https://sentia.local' ||
      !isProtectedDestination ||
      value.includes('\\')
    ) {
      return '/dashboard'
    }

    return `${url.pathname}${url.search}`
  } catch {
    return '/dashboard'
  }
}

export function legalAcceptancePath(returnPath: string) {
  return `/legal/accept?next=${encodeURIComponent(
    safeLegalReturnPath(returnPath)
  )}`
}
