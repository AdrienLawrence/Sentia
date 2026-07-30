'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { NOTEBOOK_REVISION_HEADER } from '@/lib/notebookRevisionShared'

const STALE_MESSAGE =
  'There is a newer version available. Please refresh before editing.'

function staleResponse() {
  return new Response(JSON.stringify({ error: STALE_MESSAGE }), {
    status: 409,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export type RunNotebookMutation = (
  operation: (expectedRevision: number) => Promise<Response>
) => Promise<Response>

export function useNotebookMutationQueue({
  initialRevision,
  notebookId
}: {
  initialRevision: number
  notebookId: string | null
}) {
  const [isStale, setIsStale] = useState(false)
  const [revision, setRevision] = useState(initialRevision)
  const [pendingMutationCount, setPendingMutationCount] =
    useState(0)
  const [settledMutationVersion, setSettledMutationVersion] =
    useState(0)
  const revisionRef = useRef(initialRevision)
  const isStaleRef = useRef(false)
  const queueRef = useRef(Promise.resolve())
  const channelRef = useRef<BroadcastChannel | null>(null)
  const editorSessionIdRef = useRef(crypto.randomUUID())

  const markStale = useCallback(() => {
    isStaleRef.current = true
    setIsStale(true)
  }, [])

  useEffect(() => {
    revisionRef.current = initialRevision
    isStaleRef.current = false
    queueRef.current = Promise.resolve()
    setPendingMutationCount(0)
    setSettledMutationVersion(0)
    setRevision(initialRevision)
    setIsStale(false)

    if (!notebookId || typeof BroadcastChannel === 'undefined') {
      return
    }

    const channel = new BroadcastChannel(
      `sentia:notebook:${notebookId}`
    )
    channelRef.current = channel
    channel.onmessage = (
      event: MessageEvent<{
        revision?: number
        sessionId?: string
      }>
    ) => {
      if (
        event.data?.sessionId !== editorSessionIdRef.current &&
        typeof event.data?.revision === 'number' &&
        event.data.revision > revisionRef.current
      ) {
        markStale()
      }
    }

    return () => {
      channel.close()
      if (channelRef.current === channel) {
        channelRef.current = null
      }
    }
  }, [initialRevision, markStale, notebookId])

  const runMutation: RunNotebookMutation = useCallback(
    (
      operation: (expectedRevision: number) => Promise<Response>
    ) => {
      if (!notebookId || isStaleRef.current) {
        return Promise.resolve(staleResponse())
      }

      setPendingMutationCount((count) => count + 1)
      const task = queueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (isStaleRef.current) return staleResponse()

          const response = await operation(revisionRef.current)

          if (
            response.status === 409 ||
            response.status === 404
          ) {
            markStale()
            return response
          }

          if (response.ok) {
            const nextRevision = Number(
              response.headers.get(NOTEBOOK_REVISION_HEADER)
            )

            if (Number.isSafeInteger(nextRevision)) {
              revisionRef.current = nextRevision
              setRevision(nextRevision)
              channelRef.current?.postMessage({
                revision: nextRevision,
                sessionId: editorSessionIdRef.current
              })
            }
          }

          return response
        })

      queueRef.current = task.then(
        () => undefined,
        () => undefined
      )
      const markSettled = () => {
        setPendingMutationCount((count) => Math.max(0, count - 1))
        setSettledMutationVersion((version) => version + 1)
      }
      void task.then(markSettled, markSettled)

      return task
    },
    [markStale, notebookId]
  )

  return {
    isStale,
    isMutating: pendingMutationCount > 0,
    revision,
    runMutation,
    settledMutationVersion
  }
}
