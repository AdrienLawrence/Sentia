import type { Metadata } from 'next'

import { LegalPage } from '@/features/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how Sentia collects, uses, stores, and protects account, notebook, feedback, and AI interaction data.',
  alternates: { canonical: '/privacy' }
}

export default function PrivacyPage() {
  return <LegalPage document="privacy" />
}
