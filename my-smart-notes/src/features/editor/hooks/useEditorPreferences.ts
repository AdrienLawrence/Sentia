'use client'

import { useEffect, useState } from 'react'

import {
  EDITOR_TOUR_COMPLETED_KEY
} from '../constants'
import {
  applyAppTheme,
  readAppTheme,
  saveAppTheme
} from '@/features/theme/appTheme'

export function useEditorPreferences(
  userId: string | undefined,
  activeFontSize: string
) {
  const [darkEditorPaper, setDarkEditorPaper] = useState(false)
  const [showEditorTour, setShowEditorTour] = useState(true)
  const [fontSizeInput, setFontSizeInput] = useState('16')
  const [isFontSizeInputFocused, setIsFontSizeInputFocused] =
    useState(false)

  useEffect(() => {
    const theme = readAppTheme()
    setDarkEditorPaper(theme === 'dark')
    applyAppTheme(theme)
  }, [])

  useEffect(() => {
    if (!userId) return

    setShowEditorTour(
      localStorage.getItem(
        `${EDITOR_TOUR_COMPLETED_KEY}:${userId}`
      ) !== 'true'
    )
  }, [userId])

  useEffect(() => {
    if (!isFontSizeInputFocused) {
      setFontSizeInput(activeFontSize.replace('px', ''))
    }
  }, [activeFontSize, isFontSizeInputFocused])

  const setPaperTheme = (dark: boolean) => {
    setDarkEditorPaper(dark)
    saveAppTheme(dark ? 'dark' : 'light')
  }

  const completeEditorTour = () => {
    if (userId) {
      localStorage.setItem(
        `${EDITOR_TOUR_COMPLETED_KEY}:${userId}`,
        'true'
      )
    }
    setShowEditorTour(false)
  }

  return {
    darkEditorPaper,
    fontSizeInput,
    isFontSizeInputFocused,
    showEditorTour,
    completeEditorTour,
    setFontSizeInput,
    setIsFontSizeInputFocused,
    setPaperTheme,
    setShowEditorTour
  }
}
