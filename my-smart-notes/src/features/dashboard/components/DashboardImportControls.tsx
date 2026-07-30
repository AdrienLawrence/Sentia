'use client'

import { useRef } from 'react'

import { IMPORT_FILE_ACCEPT } from '@/features/file-transfer/lib/content'

interface DashboardImportControlsProps {
  isImporting: boolean
  onImport: (files: File[]) => void
}

export function DashboardImportControls({
  isImporting,
  onImport
}: DashboardImportControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 0) onImport(files)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept={IMPORT_FILE_ACCEPT}
        multiple
        tabIndex={-1}
        onChange={handleFiles}
      />

      <input
        ref={(node) => {
          folderInputRef.current = node

          if (node) {
            node.setAttribute('webkitdirectory', '')
            node.setAttribute('directory', '')
          }
        }}
        className="sr-only"
        type="file"
        accept={IMPORT_FILE_ACCEPT}
        multiple
        tabIndex={-1}
        onChange={handleFiles}
      />

      <button
        type="button"
        disabled={isImporting}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-lg border border-slate-700 bg-[#11151c] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        {isImporting ? 'Importing...' : 'Import Files'}
      </button>

      <button
        type="button"
        disabled={isImporting}
        onClick={() => folderInputRef.current?.click()}
        className="rounded-lg border border-slate-700 bg-[#11151c] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        Import Folder
      </button>
    </div>
  )
}
