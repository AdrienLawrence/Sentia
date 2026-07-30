import type { Metadata } from 'next'

import { LegalPage } from '@/features/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Sentia Terms of Service'
}

export default function TermsPage() {
  return <LegalPage document="terms" />
}

