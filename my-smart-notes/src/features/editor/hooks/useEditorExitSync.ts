'use client'

import { useEffect, useRef } from 'react'

export function useEditorExitSync(
  flushPendingDeletions: () => void,
  flushPendingEditorState: () => void
) {
  const deletionFlushRef = useRef(flushPendingDeletions)
  const editorFlushRef = useRef(flushPendingEditorState)
  deletionFlushRef.current = flushPendingDeletions
  editorFlushRef.current = flushPendingEditorState

  useEffect(() => {
    const flush = () => {
      editorFlushRef.current()
      deletionFlushRef.current()
    }
    window.addEventListener('pagehide', flush)

    return () => {
      window.removeEventListener('pagehide', flush)

      flush()
    }
  }, [])
}
