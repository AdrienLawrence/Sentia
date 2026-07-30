'use client'

import { useEffect, useRef, useState } from 'react'

import { cleanAiReplacementText } from '../lib/aiMessageText'
import type {
  AiAction,
  AiInsertRequest,
  AiMessage,
  AiReplaceRequest,
  AiSelectionSnapshot,
  AiTarget,
  NotebookPage
} from '../model/types'

interface UseAiAssistantOptions {
  page: NotebookPage | null
  saveContentNow: (pageId: string) => Promise<boolean>
}

export function useAiAssistant({
  page,
  saveContentNow
}: UseAiAssistantOptions) {
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [isAskingAi, setIsAskingAi] = useState(false)
  const [aiInsertRequest, setAiInsertRequest] =
    useState<AiInsertRequest | null>(null)
  const [addedAiMessageIds, setAddedAiMessageIds] =
    useState<string[]>([])
  const [aiSelection, setAiSelection] =
    useState<AiSelectionSnapshot | null>(null)
  const [aiTarget, setAiTarget] = useState<AiTarget>('page')
  const [aiReplaceRequest, setAiReplaceRequest] =
    useState<AiReplaceRequest | null>(null)
  const [replacedAiMessageIds, setReplacedAiMessageIds] =
    useState<string[]>([])
  const [pendingPageReplaceId, setPendingPageReplaceId] =
    useState<string | null>(null)
  const aiMessagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showAiPanel) return

    aiMessagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [aiMessages, isAskingAi, showAiPanel])

  const askSentia = async (action: AiAction) => {
    const notebookId =
      page?.notebook?.id || page?.notebook_id
    const question = aiQuestion.trim()
    const requestTarget = aiTarget
    const requestSelection =
      requestTarget === 'selection' ? aiSelection : null

    if (
      !page ||
      !notebookId ||
      (action === 'ask' && !question)
    ) {
      return
    }

    if (requestTarget === 'selection' && !requestSelection) {
      setAiError('Select some page text first.')
      return
    }

    const targetLabel =
      requestTarget === 'selection' ? 'selection' : 'page'
    const actionLabels: Record<AiAction, string> = {
      continue: `Continue this ${targetLabel}`,
      check: `Fact-check this ${targetLabel}`,
      rewrite: `Research and rewrite this ${targetLabel}`,
      summarize: `Summarize this ${targetLabel}`,
      ask: question
    }

    setShowAiPanel(true)
    setIsAskingAi(true)
    setAiError(null)
    setAiMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: actionLabels[action]
      }
    ])

    if (action === 'ask') {
      setAiQuestion('')
    }

    try {
      const saved = await saveContentNow(page.id)

      if (!saved) {
        throw new Error(
          'Your latest changes could not be saved before asking.'
        )
      }

      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          pageId: page.id,
          question,
          action,
          target: requestTarget,
          selectedText: requestSelection?.text || '',
          history: aiMessages.slice(-6).map((message) => ({
            role: message.role,
            content: message.text.slice(0, 4_000)
          }))
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'Sentia could not answer'
        )
      }

      setAiMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: result.answer,
          action,
          target: requestTarget,
          selection: requestSelection || undefined,
          notebookCitations: result.citations || [],
          externalCitations:
            result.externalCitations || [],
          usedExternalResearch:
            result.usedExternalResearch === true
        }
      ])
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : 'Sentia could not answer'
      )
    } finally {
      setIsAskingAi(false)
    }
  }

  const replaceWithAiMessage = (message: AiMessage) => {
    const replacementText = cleanAiReplacementText(
      message.text
    ).trim()

    if (!replacementText || !message.target) return

    if (
      message.target === 'page' &&
      pendingPageReplaceId !== message.id
    ) {
      setPendingPageReplaceId(message.id)
      return
    }

    setPendingPageReplaceId(null)
    setAiReplaceRequest({
      id: crypto.randomUUID(),
      sourceMessageId: message.id,
      target: message.target,
      text: replacementText,
      selection: message.selection
    })
  }

  return {
    addedAiMessageIds,
    aiError,
    aiInsertRequest,
    aiMessages,
    aiMessagesEndRef,
    aiQuestion,
    aiReplaceRequest,
    aiSelection,
    aiTarget,
    isAskingAi,
    pendingPageReplaceId,
    replacedAiMessageIds,
    showAiPanel,
    askSentia,
    replaceWithAiMessage,
    setAddedAiMessageIds,
    setAiError,
    setAiInsertRequest,
    setAiMessages,
    setAiQuestion,
    setAiReplaceRequest,
    setAiSelection,
    setAiTarget,
    setPendingPageReplaceId,
    setReplacedAiMessageIds,
    setShowAiPanel
  }
}
