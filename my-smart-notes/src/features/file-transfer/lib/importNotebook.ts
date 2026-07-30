import type { ImportedDocument } from './content'

interface CreatedNotebook {
  id: string
  revision: number
}

interface CreatedPage {
  id: string
}

async function responseError(
  response: Response,
  fallback: string
) {
  try {
    const body = await response.json()

    if (body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // Preserve the fallback for non-JSON responses.
  }

  return fallback
}

export async function createNotebookFromImport(
  notebookName: string,
  documents: ImportedDocument[]
) {
  const notebookResponse = await fetch('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: notebookName,
      style: 'standard'
    })
  })

  if (!notebookResponse.ok) {
    throw new Error(
      await responseError(
        notebookResponse,
        'Failed to create the imported notebook.'
      )
    )
  }

  const notebook =
    (await notebookResponse.json()) as CreatedNotebook
  let notebookRevision = notebook.revision ?? 0
  let firstPageId: string | null = null

  try {
    for (const document of documents) {
      const pageResponse = await fetch(
        `/api/notebooks/${notebook.id}/pages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: document.title,
            content: document.content,
            expectedRevision: notebookRevision
          })
        }
      )

      if (!pageResponse.ok) {
        throw new Error(
          await responseError(
            pageResponse,
            `Failed to import ${document.sourceName}.`
          )
        )
      }

      const page = (await pageResponse.json()) as CreatedPage
      const nextRevision = Number(
        pageResponse.headers.get('X-Sentia-Notebook-Revision')
      )
      if (Number.isSafeInteger(nextRevision)) {
        notebookRevision = nextRevision
      }
      firstPageId ??= page.id
    }
  } catch (error) {
    await fetch(`/api/notebooks/${notebook.id}`, {
      method: 'DELETE'
    }).catch(() => undefined)

    throw error
  }

  if (!firstPageId) {
    throw new Error('No supported files were selected.')
  }

  return firstPageId
}
