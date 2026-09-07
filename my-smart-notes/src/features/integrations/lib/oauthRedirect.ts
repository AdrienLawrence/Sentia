export function isSafeOAuthRedirect(value: string) {
  try {
    const url = new URL(value)

    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' &&
        (url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1'))
    )
  } catch {
    return false
  }
}
