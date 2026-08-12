import type { Metadata } from 'next'

import { LegalPage } from '@/features/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Review the terms governing access to and use of the Sentia notebook and AI study application.',
  alternates: { canonical: '/terms' }
}

export default function TermsPage() {
  return <LegalPage document="terms" />
}
