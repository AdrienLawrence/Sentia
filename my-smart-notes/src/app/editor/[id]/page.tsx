import { EditorWorkspace } from '@/features/editor/EditorWorkspace'
import { LegalConsentGate } from '@/features/legal/LegalConsentGate'

export default function EditorPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <LegalConsentGate>
      <EditorWorkspace params={params} />
    </LegalConsentGate>
  )
}
