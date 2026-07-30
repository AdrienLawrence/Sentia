import type { Metadata } from 'next'

import { LegalPage } from '@/features/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Sentia Privacy Policy'
}

export default function PrivacyPage() {
  return <LegalPage document="privacy" />
}

