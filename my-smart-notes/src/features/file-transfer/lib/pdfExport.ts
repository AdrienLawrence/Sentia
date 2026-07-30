import type { jsPDF as JsPdfDocument } from 'jspdf'

import type { NotebookPage } from '../../editor/model/types'

import { tiptapDocumentToPlainText } from './content'

const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const MARGIN_X_MM = 18
const MARGIN_TOP_MM = 18
const MARGIN_BOTTOM_MM = 16
const TITLE_LINE_HEIGHT_MM = 7
const BODY_LINE_HEIGHT_MM = 5.2

function safeFileName(value: string) {
  const safeName = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return safeName || 'Sentia Export'
}

function addPhysicalPageHeader(
  pdf: JsPdfDocument,
  notebookName: string,
  pageTitle: string
) {
  pdf.setTextColor(28, 35, 45)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text(pageTitle || 'Untitled Page', MARGIN_X_MM, MARGIN_TOP_MM)

  pdf.setTextColor(105, 114, 126)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text(
    notebookName || 'My Notebook',
    PAGE_WIDTH_MM - MARGIN_X_MM,
    MARGIN_TOP_MM,
    { align: 'right' }
  )

  pdf.setDrawColor(214, 220, 228)
  pdf.line(
    MARGIN_X_MM,
    MARGIN_TOP_MM + 3,
    PAGE_WIDTH_MM - MARGIN_X_MM,
    MARGIN_TOP_MM + 3
  )
}

function addFooters(pdf: JsPdfDocument) {
  const pageCount = pdf.getNumberOfPages()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.setTextColor(130, 138, 148)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(
      `${pageNumber} / ${pageCount}`,
      PAGE_WIDTH_MM - MARGIN_X_MM,
      PAGE_HEIGHT_MM - 8,
      { align: 'right' }
    )
  }
}

function paginateLogicalLines(
  pdf: JsPdfDocument,
  text: string,
  contentWidth: number,
  linesPerPage: number
) {
  const physicalPages: string[][] = []
  let currentPage: string[] = []

  for (const logicalLine of (text || ' ').split('\n')) {
    const wrappedLine = (
      pdf.splitTextToSize(
        logicalLine || ' ',
        contentWidth
      ) as string[]
    )

    if (
      currentPage.length > 0 &&
      currentPage.length + wrappedLine.length > linesPerPage
    ) {
      physicalPages.push(currentPage)
      currentPage = []
    }

    if (wrappedLine.length > linesPerPage) {
      for (
        let start = 0;
        start < wrappedLine.length;
        start += linesPerPage
      ) {
        const segment = wrappedLine.slice(
          start,
          start + linesPerPage
        )

        if (segment.length === linesPerPage) {
          physicalPages.push(segment)
        } else {
          currentPage = segment
        }
      }

      continue
    }

    currentPage.push(...wrappedLine)
  }

  if (currentPage.length > 0) {
    physicalPages.push(currentPage)
  }

  return physicalPages.length > 0 ? physicalPages : [[' ']]
}

export async function createPagesPdf(
  notebookName: string,
  pages: NotebookPage[]
) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true
  })
  const contentWidth = PAGE_WIDTH_MM - MARGIN_X_MM * 2
  const bodyStart = MARGIN_TOP_MM + TITLE_LINE_HEIGHT_MM
  const bodyHeight =
    PAGE_HEIGHT_MM - bodyStart - MARGIN_BOTTOM_MM
  const linesPerPage = Math.max(
    1,
    Math.floor(bodyHeight / BODY_LINE_HEIGHT_MM)
  )
  let hasRenderedPage = false

  for (const page of pages) {
    const pageTitle = page.title?.trim() || 'Untitled Page'
    const plainText = tiptapDocumentToPlainText(page.content)
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()
    const physicalPages = paginateLogicalLines(
      pdf,
      plainText,
      contentWidth,
      linesPerPage
    )

    for (const pageLines of physicalPages) {
      if (hasRenderedPage) pdf.addPage('a4', 'portrait')
      hasRenderedPage = true

      addPhysicalPageHeader(pdf, notebookName, pageTitle)
      pdf.setTextColor(37, 44, 54)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10.5)

      pdf.text(pageLines, MARGIN_X_MM, bodyStart, {
        baseline: 'top',
        lineHeightFactor: 1.35
      })
    }
  }

  addFooters(pdf)
  return pdf
}

export async function exportPagesToPdf(
  notebookName: string,
  pages: NotebookPage[],
  fileName: string
) {
  const pdf = await createPagesPdf(notebookName, pages)
  pdf.save(`${safeFileName(fileName)}.pdf`)
}
