import {
  isSupportedImportFile,
  markdownToTiptapDocument,
  MAX_IMPORT_FILE_BYTES,
  plainTextToTiptapDocument,
  titleFromFileName,
  type ImportedDocument
} from './content'

export async function readImportedFile(
  file: File
): Promise<ImportedDocument> {
  if (!isSupportedImportFile(file)) {
    throw new Error(
      'Unsupported file type. Choose a TXT, Markdown, or PDF file.'
    )
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Each imported file must be 10 MB or smaller.')
  }

  const extension =
    file.name.split('.').pop()?.toLocaleLowerCase() ?? ''

  if (extension === 'pdf') {
    const text = await extractPdfText(await file.arrayBuffer())

    return {
      content: plainTextToTiptapDocument(text),
      sourceName: file.name,
      title: titleFromFileName(file.name)
    }
  }

  const text = await file.text()
  const content =
    extension === 'md' || extension === 'markdown'
      ? markdownToTiptapDocument(text)
      : plainTextToTiptapDocument(text)

  return {
    content,
    sourceName: file.name,
    title: titleFromFileName(file.name)
  }
}

async function extractPdfText(data: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist')

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data)
  })
  const document = await loadingTask.promise

  if (document.numPages > 250) {
    await loadingTask.destroy()
    throw new Error('PDF imports are limited to 250 pages per file.')
  }

  const pages: string[] = []

  try {
    for (
      let pageNumber = 1;
      pageNumber <= document.numPages;
      pageNumber += 1
    ) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      let previousY: number | null = null
      let pageText = ''

      for (const item of textContent.items) {
        if (!('str' in item)) continue

        const currentY =
          typeof item.transform?.[5] === 'number'
            ? item.transform[5]
            : null
        const startsNewLine =
          previousY !== null &&
          currentY !== null &&
          Math.abs(previousY - currentY) > 2

        if (startsNewLine && !pageText.endsWith('\n')) {
          pageText += '\n'
        } else if (
          pageText &&
          !pageText.endsWith('\n') &&
          !pageText.endsWith(' ') &&
          item.str &&
          !/^[,.;:!?)]/.test(item.str)
        ) {
          pageText += ' '
        }

        pageText += item.str

        if (item.hasEOL) {
          pageText += '\n'
        }

        previousY = currentY
      }

      pages.push(pageText.trim())
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return pages.join('\n\n').trim()
}
