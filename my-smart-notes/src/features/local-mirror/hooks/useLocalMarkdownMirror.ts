'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { NotebookPage } from '@/features/editor/model/types'
import {
  createConnectedMarkdownDirectory,
  forgetDirectoryHandle,
  loadDirectoryHandle,
  storeDirectoryHandle,
  syncNotebookToDirectory,
  type LocalDirectoryHandle
} from '@/features/local-mirror/lib/localMarkdownMirror'

export type LocalMirrorStatus =
  | 'connecting'
  | 'disconnected'
  | 'error'
  | 'permission-required'
  | 'synced'
  | 'syncing'
  | 'unsupported'

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string
    mode?: 'read' | 'readwrite'
  }) => Promise<LocalDirectoryHandle>
}

export function useLocalMarkdownMirror({
  committedRevision,
  isActive,
  notebookId,
  notebookName,
  pages,
  settledMutationVersion
}: {
  committedRevision: number
  isActive: boolean
  notebookId: string | null
  notebookName: string
  pages: NotebookPage[]
  settledMutationVersion: number
}) {
  const [directory, setDirectory] =
    useState<LocalDirectoryHandle | null>(null)
  const [status, setStatus] =
    useState<LocalMirrorStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const syncSequenceRef = useRef(Promise.resolve())
  const syncGenerationRef = useRef(0)
  const snapshotRef = useRef({
    notebookName,
    pages
  })
  snapshotRef.current = { notebookName, pages }
  const hasPages = pages.length > 0

  const isSupported =
    typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker ===
      'function' &&
    typeof indexedDB !== 'undefined'

  useEffect(() => {
    let cancelled = false
    syncGenerationRef.current += 1
    syncSequenceRef.current = Promise.resolve()

    setDirectory(null)
    setError(null)

    if (!notebookId) {
      setStatus('disconnected')
      return () => {
        cancelled = true
      }
    }

    if (!isSupported) {
      setStatus('unsupported')
      return () => {
        cancelled = true
      }
    }

    void loadDirectoryHandle(notebookId)
      .then(async (storedDirectory) => {
        if (cancelled || !storedDirectory) {
          if (!cancelled) setStatus('disconnected')
          return
        }

        setDirectory(storedDirectory)
        const permission = await storedDirectory.queryPermission({
          mode: 'readwrite'
        })

        if (cancelled) return
        setStatus(
          permission === 'granted'
            ? 'synced'
            : 'permission-required'
        )
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error(
          'Failed to restore the local folder connection:',
          loadError
        )
        setError('The saved local folder connection could not be restored.')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [isSupported, notebookId])

  const queueSync = useCallback(
    (
      targetDirectory: LocalDirectoryHandle,
      verifyUnchanged = false
    ) => {
      const snapshot = snapshotRef.current
      if (!notebookId || snapshot.pages.length === 0) return
      const generation = syncGenerationRef.current

      setStatus('syncing')
      setError(null)

      syncSequenceRef.current = syncSequenceRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== syncGenerationRef.current) return
          const permission =
            await targetDirectory.queryPermission({
              mode: 'readwrite'
            })

          if (generation !== syncGenerationRef.current) return
          if (permission !== 'granted') {
            setStatus('permission-required')
            return
          }

          const performSync = () =>
            syncNotebookToDirectory({
              directory: targetDirectory,
              notebookId,
              notebookName: snapshot.notebookName,
              pages: snapshot.pages,
              verifyUnchanged,
              shouldContinue: () =>
                generation === syncGenerationRef.current
            })

          if (navigator.locks) {
            await navigator.locks.request(
              'sentia:local-mirror',
              performSync
            )
          } else {
            await performSync()
          }

          if (generation === syncGenerationRef.current) {
            setStatus('synced')
          }
        })
        .catch((syncError) => {
          if (
            generation !== syncGenerationRef.current ||
            (syncError instanceof DOMException &&
              syncError.name === 'AbortError')
          ) {
            return
          }
          console.error(
            'Failed to mirror the notebook locally:',
            syncError
          )
          setError(
            syncError instanceof Error
              ? syncError.message
              : 'The notebook could not be mirrored locally.'
          )
          setStatus('error')
        })
    },
    [notebookId]
  )

  useEffect(() => {
    if (!directory || !isActive) {
      if (!isActive) syncGenerationRef.current += 1
      return
    }

    const timeout = window.setTimeout(() => {
      queueSync(directory)
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [
    committedRevision,
    directory,
    hasPages,
    isActive,
    queueSync,
    settledMutationVersion
  ])

  const connectOrSync = async (
    prepareForSync?: () => Promise<boolean>
  ) => {
    if (!notebookId || !isSupported) return

    setError(null)

    try {
      setStatus('connecting')
      let targetDirectory = directory

      if (!targetDirectory) {
        const parentDirectory = await (
          window as DirectoryPickerWindow
        ).showDirectoryPicker?.({
          id: 'sentia-local-markdown',
          mode: 'readwrite'
        })

        if (!parentDirectory) {
          setStatus('disconnected')
          return
        }

        const parentPermission =
          await parentDirectory.requestPermission({
            mode: 'readwrite'
          })

        if (parentPermission !== 'granted') {
          setStatus('permission-required')
          return
        }

        targetDirectory =
          await createConnectedMarkdownDirectory({
            parentDirectory,
            notebookId,
            notebookName
          })
      } else {
        const permission = await targetDirectory.requestPermission({
          mode: 'readwrite'
        })

        if (permission !== 'granted') {
          setStatus('permission-required')
          return
        }
      }

      if (prepareForSync && !(await prepareForSync())) {
        setStatus(directory ? 'synced' : 'disconnected')
        return
      }

      if (!directory) {
        await storeDirectoryHandle(notebookId, targetDirectory)
        setDirectory(targetDirectory)
      }

      queueSync(targetDirectory, true)
    } catch (connectError) {
      if (
        connectError instanceof DOMException &&
        connectError.name === 'AbortError'
      ) {
        setStatus('disconnected')
        return
      }

      console.error(
        'Failed to connect the local folder:',
        connectError
      )
      setError(
        connectError instanceof Error
          ? connectError.message
          : 'The local folder could not be connected.'
      )
      setStatus('error')
    }
  }

  const disconnect = async () => {
    if (!notebookId) return

    syncGenerationRef.current += 1

    try {
      await forgetDirectoryHandle(notebookId)
    } catch (disconnectError) {
      console.error(
        'Failed to forget the local folder connection:',
        disconnectError
      )
    }

    setDirectory(null)
    setError(null)
    setStatus(isSupported ? 'disconnected' : 'unsupported')
  }

  return {
    connectOrSync,
    directoryName: directory?.name ?? null,
    disconnect,
    error,
    isConnected: directory !== null,
    status
  }
}
