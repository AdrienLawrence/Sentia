import { useState, type RefObject } from 'react'

import styles from '@/app/editor/[id]/Editor.module.css'
import { renderAiMessageText } from '@/features/editor/lib/aiMessageText'
import type {
  AiAction,
  AiCitation,
  AiMessage,
  AiSelectionSnapshot,
  AiTarget
} from '@/features/editor/model/types'

interface AiAssistantPanelProps {
  addedMessageIds: string[]
  error: string | null
  isAsking: boolean
  messages: AiMessage[]
  messagesEndRef: RefObject<HTMLDivElement | null>
  pendingPageReplaceId: string | null
  question: string
  replacedMessageIds: string[]
  selection: AiSelectionSnapshot | null
  target: AiTarget
  onAction: (action: AiAction) => void
  onAddToPage: (message: AiMessage) => void
  onCancelPageReplace: () => void
  onClose: () => void
  onOpenCitation: (citation: AiCitation) => void
  onQuestionChange: (question: string) => void
  onReplace: (message: AiMessage) => void
  onTargetChange: (target: AiTarget) => void
}

export function AiAssistantPanel({
  addedMessageIds,
  error,
  isAsking,
  messages,
  messagesEndRef,
  pendingPageReplaceId,
  question,
  replacedMessageIds,
  selection,
  target,
  onAction,
  onAddToPage,
  onCancelPageReplace,
  onClose,
  onOpenCitation,
  onQuestionChange,
  onReplace,
  onTargetChange
}: AiAssistantPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <aside
      className={`${styles.aiPanel} ${
        isFullscreen ? styles.aiPanelFullscreen : ''
      }`}
      aria-label="Sentia notebook assistant"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()

          if (isFullscreen) {
            setIsFullscreen(false)
          } else {
            onClose()
          }
        }
      }}
    >
      <div className={styles.aiPanelHeader}>
        <div>
          <h2>Sentia</h2>
          <span className={styles.aiStatus}>
            Notebook assistant
          </span>
        </div>
        <div className={styles.aiHeaderActions}>
          <button
            type="button"
            className={styles.aiCloseButton}
            aria-label={
              isFullscreen
                ? 'Exit full screen'
                : 'Open full screen'
            }
            title={
              isFullscreen
                ? 'Exit full screen'
                : 'Open full screen'
            }
            aria-pressed={isFullscreen}
            onClick={() =>
              setIsFullscreen((fullscreen) => !fullscreen)
            }
          >
            {isFullscreen ? '↙' : '↗'}
          </button>
          <button
            type="button"
            className={styles.aiCloseButton}
            aria-label="Close Sentia"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.aiMessages}>
        {messages.length === 0 && (
          <div className={styles.aiWelcome}>
            Ask about this page, expand on a topic, or ask AI to
            draft something you can add to your notes.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.aiMessage} ${
              message.role === 'user'
                ? styles.aiUserMessage
                : styles.aiAssistantMessage
            }`}
          >
            {message.role === 'assistant' &&
              message.usedExternalResearch && (
                <span className={styles.aiResearchBadge}>
                  WEB VERIFIED
                </span>
              )}

            {message.role === 'assistant' && message.target && (
              <span className={styles.aiScopeBadge}>
                {message.target === 'selection'
                  ? 'SELECTION'
                  : 'WHOLE PAGE'}
              </span>
            )}

            <p className={styles.aiMessageBody}>
              {renderAiMessageText(message, onOpenCitation)}
            </p>

            {message.notebookCitations &&
              message.notebookCitations.length > 0 && (
                <div className={styles.aiSources}>
                  <span>Notebook</span>
                  {message.notebookCitations.map((citation) => (
                    <button
                      key={`${citation.number}-${citation.pageId}`}
                      type="button"
                      title={citation.excerpt}
                      onClick={() => onOpenCitation(citation)}
                    >
                      [{citation.number}] {citation.pageTitle}
                    </button>
                  ))}
                </div>
              )}

            {message.externalCitations &&
              message.externalCitations.length > 0 && (
                <div className={styles.aiExternalSources}>
                  <span>External sources</span>
                  {message.externalCitations.map((citation) => (
                    <a
                      key={citation.url}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {citation.title}
                    </a>
                  ))}
                </div>
              )}

            {message.role === 'assistant' && (
              <div className={styles.aiMessageActions}>
                <button
                  type="button"
                  disabled={addedMessageIds.includes(message.id)}
                  onClick={() => onAddToPage(message)}
                >
                  {addedMessageIds.includes(message.id)
                    ? 'Added'
                    : 'Add to page'}
                </button>

                {(message.action === 'rewrite' ||
                  message.action === 'summarize') &&
                  message.target && (
                    <button
                      type="button"
                      disabled={replacedMessageIds.includes(
                        message.id
                      )}
                      className={
                        pendingPageReplaceId === message.id
                          ? styles.aiConfirmReplaceButton
                          : ''
                      }
                      onClick={() => onReplace(message)}
                    >
                      {replacedMessageIds.includes(message.id)
                        ? 'Applied'
                        : pendingPageReplaceId === message.id
                          ? 'Confirm replace'
                          : message.target === 'selection'
                            ? 'Replace selection'
                            : 'Replace page'}
                    </button>
                  )}

                {pendingPageReplaceId === message.id && (
                  <button
                    type="button"
                    onClick={onCancelPageReplace}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {isAsking && (
          <div
            className={`${styles.aiMessage} ${styles.aiAssistantMessage} ${styles.aiThinking}`}
          >
            Searching and reading...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.aiComposer}>
        <div className={styles.aiTargetRow}>
          <span>WORK ON</span>
          <button
            type="button"
            className={
              target === 'page' ? styles.aiTargetActive : ''
            }
            aria-pressed={target === 'page'}
            onClick={() => onTargetChange('page')}
          >
            Whole page
          </button>
          <button
            type="button"
            disabled={!selection}
            title={
              selection?.text || 'Select text in the page first'
            }
            className={
              target === 'selection'
                ? styles.aiTargetActive
                : ''
            }
            aria-pressed={target === 'selection'}
            onClick={() => onTargetChange('selection')}
          >
            Selection
          </button>
        </div>

        {target === 'selection' && selection && (
          <div className={styles.aiSelectionPreview}>
            “
            {selection.text.length > 110
              ? `${selection.text.slice(0, 110)}...`
              : selection.text}
            ”
          </div>
        )}

        <div className={styles.aiActionRow}>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => onAction('continue')}
          >
            Continue
          </button>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => onAction('summarize')}
          >
            Summarize
          </button>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => onAction('check')}
          >
            Fact-check
          </button>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => onAction('rewrite')}
          >
            Rewrite
          </button>
        </div>

        {error && <p className={styles.aiError}>{error}</p>}

        <div className={styles.aiInputRow}>
          <textarea
            aria-label="Message Sentia"
            value={question}
            maxLength={2000}
            rows={1}
            placeholder="Ask, expand, or draft notes..."
            onChange={(event) =>
              onQuestionChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()

                if (!isAsking && question.trim()) {
                  onAction('ask')
                }
              }
            }}
          />
          <button
            type="button"
            className={styles.aiAskButton}
            aria-label="Send message"
            disabled={isAsking || !question.trim()}
            onClick={() => onAction('ask')}
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  )
}
