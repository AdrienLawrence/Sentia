'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

import {
  LEGAL_CONSENT_SESSION_KEY,
  LEGAL_DOCUMENT_OPEN_EVENT
} from './constants'

const LegalDocumentsModal = dynamic(() =>
  import('./LegalDocumentsModal').then(
    (module) => module.LegalDocumentsModal
  )
)

const PROTECTED_PATH_PREFIXES = ['/dashboard', '/editor', '/quiz']

export function LegalConsentGate({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isRequired, setIsRequired] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const verifiedPathRef = useRef<string | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const handleOpenRequest = () => {
      setError(null)
      setIsRequired(false)
      setIsOpen(true)
    }

    window.addEventListener(
      LEGAL_DOCUMENT_OPEN_EVENT,
      handleOpenRequest
    )

    return () => {
      window.removeEventListener(
        LEGAL_DOCUMENT_OPEN_EVENT,
        handleOpenRequest
      )
    }
  }, [])

  useEffect(() => {
    if (
      !PROTECTED_PATH_PREFIXES.some((prefix) =>
        pathname.startsWith(prefix)
      )
    ) {
      setIsOpen(false)
      setIsRequired(false)
      return
    }

    if (verifiedPathRef.current === pathname) return
    verifiedPathRef.current = pathname

    const verifyConsent = async () => {
      try {
        if (
          sessionStorage.getItem(
            LEGAL_CONSENT_SESSION_KEY
          ) ===
          'accepted'
        ) {
          return
        }

        const response = await fetch('/api/legal-consent', {
          method: 'GET',
          cache: 'no-store'
        })
        const result = await response.json()

        if (response.status === 401) return

        if (!response.ok) {
          throw new Error(
            result.error || 'Could not verify legal acceptance.'
          )
        }

        currentUserIdRef.current =
          typeof result.userId === 'string'
            ? result.userId
            : null

        if (result.accepted) {
          sessionStorage.setItem(
            LEGAL_CONSENT_SESSION_KEY,
            'accepted'
          )
        } else {
          setIsRequired(true)
          setIsOpen(true)
        }
      } catch (consentError) {
        setError(
          consentError instanceof Error
            ? consentError.message
            : 'Could not verify legal acceptance.'
        )
        setIsRequired(true)
        setIsOpen(true)
      }
    }

    void verifyConsent()
  }, [pathname])

  const acceptDocuments = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/legal-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          privacyAccepted: true,
          termsAccepted: true
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'Could not save legal acceptance.'
        )
      }

      if (currentUserIdRef.current) {
        sessionStorage.setItem(
          LEGAL_CONSENT_SESSION_KEY,
          'accepted'
        )
      }
      setIsRequired(false)
      setIsOpen(false)
    } catch (consentError) {
      setError(
        consentError instanceof Error
          ? consentError.message
          : 'Could not save legal acceptance.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {children}
      <LegalDocumentsModal
        error={error}
        isOpen={isOpen}
        isRequired={isRequired}
        isSubmitting={isSubmitting}
        onAccept={() => void acceptDocuments()}
        onClose={() => {
          if (!isRequired && !isSubmitting) setIsOpen(false)
        }}
      />
    </>
  )
}
