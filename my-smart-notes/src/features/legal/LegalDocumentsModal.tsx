'use client'

import { useEffect, useRef, useState } from 'react'

import { useDialogKeyboard } from '@/lib/accessibility/useDialogKeyboard'
import {
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION
} from './constants'
import {
  LegalDocumentContent,
  type LegalDocumentType
} from './policyContent'

interface LegalDocumentsModalProps {
  error: string | null
  isOpen: boolean
  isRequired: boolean
  isSubmitting: boolean
  onAccept: () => void
  onClose: () => void
  presentation?: 'modal' | 'page'
}

export function LegalDocumentsModal({
  error,
  isOpen,
  isRequired,
  isSubmitting,
  onAccept,
  onClose,
  presentation = 'modal'
}: LegalDocumentsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const documentScrollRef = useRef<HTMLDivElement>(null)
  const [activeDocument, setActiveDocument] =
    useState<LegalDocumentType>('privacy')
  const [privacyReviewed, setPrivacyReviewed] = useState(false)
  const [termsReviewed, setTermsReviewed] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  useDialogKeyboard({
    closeOnEscape: !isRequired && !isSubmitting,
    dialogRef,
    isOpen,
    onClose
  })

  useEffect(() => {
    if (!isOpen || !isRequired) return
    setActiveDocument('privacy')
    setPrivacyReviewed(false)
    setTermsReviewed(false)
    setPrivacyAccepted(false)
    setTermsAccepted(false)
  }, [isOpen, isRequired])

  useEffect(() => {
    const scrollArea = documentScrollRef.current
    if (!isOpen || !scrollArea) return

    scrollArea.scrollTop = 0

    const frame = window.requestAnimationFrame(() => {
      if (
        scrollArea.scrollHeight <=
        scrollArea.clientHeight + 8
      ) {
        if (activeDocument === 'privacy') {
          setPrivacyReviewed(true)
        } else {
          setTermsReviewed(true)
        }
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeDocument, isOpen])

  if (!isOpen) return null

  const canAccept =
    privacyReviewed &&
    termsReviewed &&
    privacyAccepted &&
    termsAccepted &&
    !isSubmitting

  const markDocumentReviewed = (
    element: HTMLDivElement,
    document: LegalDocumentType
  ) => {
    const reachedEnd =
      element.scrollHeight -
        element.scrollTop -
        element.clientHeight <=
      8

    if (!reachedEnd) return

    if (document === 'privacy') {
      setPrivacyReviewed(true)
    } else {
      setTermsReviewed(true)
    }
  }

  return (
    <div
      role={presentation === 'modal' ? 'presentation' : undefined}
      className={
        presentation === 'modal'
          ? 'fixed inset-0 z-[1500] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6'
          : 'flex min-h-screen items-center justify-center bg-[#080a0e] p-3 sm:p-6'
      }
      onMouseDown={(event) => {
        if (
          presentation === 'modal' &&
          event.target === event.currentTarget &&
          !isRequired &&
          !isSubmitting
        ) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role={presentation === 'modal' ? 'dialog' : 'main'}
        aria-modal={presentation === 'modal' ? true : undefined}
        aria-labelledby="legal-documents-title"
        aria-describedby={
          isRequired ? 'legal-consent-description' : undefined
        }
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d1117] text-slate-100 shadow-2xl shadow-black/60"
      >
        <header className="border-b border-slate-800 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-sky-300">
                PRIVACY & TERMS
              </p>
              <h2
                id="legal-documents-title"
                className="mt-1 text-xl font-semibold tracking-tight"
              >
                {isRequired
                  ? 'Review before continuing'
                  : 'Sentia legal documents'}
              </h2>
              {isRequired && (
                <p
                  id="legal-consent-description"
                  className="mt-1 text-sm text-slate-400"
                >
                  Scroll to the end of each document, then
                  acknowledge the Privacy Policy and agree to the
                  Terms.
                </p>
              )}
            </div>

            {!isRequired && (
              <button
                type="button"
                aria-label="Close legal documents"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Legal documents"
            className="mt-4 flex gap-2"
          >
            {(
              [
                ['privacy', 'Privacy Policy'],
                ['terms', 'Terms of Service']
              ] as const
            ).map(([value, label]) => {
              const reviewed =
                value === 'privacy'
                  ? privacyReviewed
                  : termsReviewed

              return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeDocument === value}
                aria-controls="legal-document-panel"
                onClick={() => {
                  if (documentScrollRef.current) {
                    documentScrollRef.current.scrollTop = 0
                  }
                  setActiveDocument(value)
                }}
                className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                  activeDocument === value
                    ? 'border-sky-700 bg-sky-950/50 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
                }`}
              >
                {label}
                {isRequired && reviewed ? ' · Reviewed' : ''}
              </button>
              )
            })}
          </div>
        </header>

        <div
          id="legal-document-panel"
          ref={documentScrollRef}
          role="tabpanel"
          tabIndex={0}
          onScroll={(event) =>
            markDocumentReviewed(
              event.currentTarget,
              activeDocument
            )
          }
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 [scrollbar-color:#566473_#1d2228] [scrollbar-width:thin] sm:px-8"
        >
          <LegalDocumentContent document={activeDocument} />
        </div>

        <footer className="border-t border-slate-800 bg-[#0a0d12] px-5 py-4 sm:px-6">
          {isRequired ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-[#11151c] p-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!privacyReviewed}
                    checked={privacyAccepted}
                    onChange={(event) =>
                      setPrivacyAccepted(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <span>
                    {privacyReviewed
                      ? `I acknowledge the Privacy Policy, version ${PRIVACY_POLICY_VERSION}.`
                      : 'Scroll to the end of the Privacy Policy to enable this acknowledgment.'}
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-[#11151c] p-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!termsReviewed}
                    checked={termsAccepted}
                    onChange={(event) =>
                      setTermsAccepted(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <span>
                    {termsReviewed
                      ? `I agree to the Terms of Service, version ${TERMS_OF_SERVICE_VERSION}.`
                      : 'Scroll to the end of the Terms of Service to enable this agreement.'}
                  </span>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  If you do not agree, sign out or close Sentia.
                </p>
                <button
                  type="button"
                  disabled={!canAccept}
                  onClick={onAccept}
                  className="rounded-md border border-sky-700 bg-sky-900/60 px-5 py-2 text-sm font-medium text-sky-50 hover:bg-sky-800/70 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"
                >
                  {isSubmitting
                    ? 'Saving acceptance...'
                    : 'Accept and Continue'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Current versions: Privacy {PRIVACY_POLICY_VERSION} ·
                Terms {TERMS_OF_SERVICE_VERSION}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Done
              </button>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}
