export const APP_THEME_KEY = 'sentia:appTheme'
export const LEGACY_EDITOR_THEME_KEY = 'sentia:editorPaperTheme'

export type AppTheme = 'dark' | 'light'

export function readAppTheme(): AppTheme {
  const storedTheme = localStorage.getItem(APP_THEME_KEY)

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  const legacyTheme = localStorage.getItem(LEGACY_EDITOR_THEME_KEY)
  return legacyTheme === 'light' ? 'light' : 'dark'
}

export function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme
  document.documentElement.style.colorScheme = theme
}

export function saveAppTheme(theme: AppTheme) {
  localStorage.setItem(APP_THEME_KEY, theme)
  localStorage.setItem(LEGACY_EDITOR_THEME_KEY, theme)
  applyAppTheme(theme)
}
