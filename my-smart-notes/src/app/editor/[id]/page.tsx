'use client'

import styles from './Editor.module.css'
import { TiptapEditor } from '@/components/TiptapEditor'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEditorStore } from '@/components/editor/useEditorStore'

interface DrawBox {
  id: string
  x_position: number
  y_position: number
  width: number
  height: number
  elements?: Array<any>
}

interface Notebook {
  id: string
  name: string
  style: string
}

interface Page {
  id: string
  title?: string
  content?: any
  notebook?: Notebook
  notebook_id?: string
  draw_boxes?: DrawBox[]
}

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'read' | 'write'>('write')
  const [pages, setPages] = useState<Page[]>([])
  const [error, setError] = useState<string | null>(null)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Get store state AND actions
  const {
    // STATE VALUES
    isBold,
    isItalic,
    isStrikethrough,
    isBulletList,
    isOrderedList,
    textColor,
    alignment,
    fontSize,
    fontFamily,
    
    // ACTIONS
    setBold,
    setItalic,
    setStrikethrough,
    setBulletList,
    setOrderedList,
    setTextColor,
    setAlignment,
    setFontSize,
    setFontFamily,
  } = useEditorStore()

  useEffect(() => {
    async function loadPage() {
      try {
        const { id } = await params
        console.log('Loading page with ID:', id)
        
        const pageResponse = await fetch(`/api/pages/${id}`)
        console.log('Page API Response status:', pageResponse.status)
        
        if (!pageResponse.ok) {
          throw new Error(`Failed to load page: ${pageResponse.status}`)
        }
        
        const pageData = await pageResponse.json()
        console.log('Loaded page data:', pageData)
        setPage(pageData)
        
        // Load pages for this notebook
        if (pageData.notebook || pageData.notebook_id) {
          const notebookId = pageData.notebook?.id || pageData.notebook_id
          console.log('Loading pages for notebook:', notebookId)
          
          try {
            const pagesResponse = await fetch(`/api/notebooks/${notebookId}/pages`)
            if (pagesResponse.ok) {
              const allPages = await pagesResponse.json()
              console.log('Loaded pages:', allPages)
              setPages(allPages || [])
            } else {
              console.log('No pages found or API error, using empty array')
              setPages([])
            }
          } catch (pagesError) {
            console.log('Error fetching pages, using empty array:', pagesError)
            setPages([])
          }
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Error loading page:', error)
        setError('Failed to load page')
        setLoading(false)
      }
    }
    loadPage()
  }, [params])

  const handlePageTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (page) {
      fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: e.target.value })
      })
    }
  }

  const handlePageClick = (pageId: string) => {
    router.push(`/editor/${pageId}`)
  }

  // FIXED: Font size handler that accepts typing
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = e.target.value
    
    // Only allow numbers between 8 and 72
    if (/^\d*$/.test(size) && (size === '' || (parseInt(size) >= 8 && parseInt(size) <= 72))) {
      const numericSize = size === '' ? '12' : size
      
      // IMMEDIATELY update store with 'px' suffix
      handleSidebarAction(() => setFontSize(numericSize + 'px'))
    }
  }

  const handleFontSizeBlur = () => {
    // Ensure we have valid font size
    const currentSize = fontSize.replace('px', '')
    if (currentSize === '' || parseInt(currentSize) < 8) {
      handleSidebarAction(() => setFontSize('12px'))
    }
  }

  const handleContentUpdate = (newContent: any) => {
    console.log('Content updated:', newContent)
  }

  const handlePreviousPage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!page || pages.length === 0) return
    
    const currentIndex = pages.findIndex(p => p.id === page.id)
    if (currentIndex > 0) {
      router.push(`/editor/${pages[currentIndex - 1].id}`)
    }
  }

  const handleNextPage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!page || pages.length === 0) return
    
    const currentIndex = pages.findIndex(p => p.id === page.id)
    if (currentIndex < pages.length - 1) {
      router.push(`/editor/${pages[currentIndex + 1].id}`)
    }
  }

  // Google Docs-style focus-preserving sidebar action
  const handleSidebarAction = (action: () => void, e?: React.MouseEvent) => {
    // Prevent button from stealing focus
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Store current selection BEFORE anything
    const selection = window.getSelection()
    let savedRange = null
    
    if (selection && selection.rangeCount > 0) {
      savedRange = selection.getRangeAt(0).cloneRange()
    }
    
    // Execute the action
    action()
    
    // Google Docs-style instant refocus
    requestAnimationFrame(() => {
      const editorElement = document.querySelector('.ProseMirror') as HTMLElement
      if (editorElement) {
        // Refocus without scrolling or moving cursor
        editorElement.focus({ preventScroll: true })
        
        // Restore exact selection if we had one
        if (savedRange && selection) {
          selection.removeAllRanges()
          selection.addRange(savedRange)
        }
      }
    })
  }

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value as 'read' | 'write')
    
    // Refocus editor after mode change
    requestAnimationFrame(() => {
      const editorElement = document.querySelector('.ProseMirror') as HTMLElement
      if (editorElement) {
        editorElement.focus({ preventScroll: true })
      }
    })
  }

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleSidebarAction(() => setFontFamily(e.target.value))
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSidebarAction(() => setTextColor(e.target.value))
  }

  // Google Docs-style button handlers
  const handleBoldClick = (e: React.MouseEvent) => {
    handleSidebarAction(() => setBold(!isBold), e)
  }

  const handleItalicClick = (e: React.MouseEvent) => {
    handleSidebarAction(() => setItalic(!isItalic), e)
  }

  const handleStrikeClick = (e: React.MouseEvent) => {
    handleSidebarAction(() => setStrikethrough(!isStrikethrough), e)
  }

  const handleAlignmentClick = (align: 'left' | 'center' | 'right' | 'justify', e: React.MouseEvent) => {
    handleSidebarAction(() => setAlignment(align), e)
  }

  const handleListClick = (listType: 'bullets' | 'numbers', e: React.MouseEvent) => {
    if (listType === 'bullets') {
      handleSidebarAction(() => setBulletList(!isBulletList), e)
    } else {
      handleSidebarAction(() => setOrderedList(!isOrderedList), e)
    }
  }

  // Insert handlers with Google Docs focus behavior
  const handleInsertClick = (insertType: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Insert:', insertType)
    
    // Keep focus in editor
    requestAnimationFrame(() => {
      const editorElement = document.querySelector('.ProseMirror') as HTMLElement
      if (editorElement) {
        editorElement.focus({ preventScroll: true })
      }
    })
  }

  const handleFileOptionClick = (option: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (option === 'home') {
      router.push('/dashboard')
    } else {
      console.log('File option:', option)
      // Keep focus in editor
      requestAnimationFrame(() => {
        const editorElement = document.querySelector('.ProseMirror') as HTMLElement
        if (editorElement) {
          editorElement.focus({ preventScroll: true })
        }
      })
    }
  }

  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingText}>Loading...</div>
    </div>
  )
  
  if (error) return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingText}>{error}</div>
    </div>
  )
  
  if (!page) return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingText}>Page not found</div>
    </div>
  )

  const currentPageIndex = pages.findIndex(p => p.id === page.id)
  const hasPreviousPage = currentPageIndex > 0
  const hasNextPage = currentPageIndex < pages.length - 1

  // Display font size without 'px' for editing
  const displayFontSize = fontSize.replace('px', '')

  return (
    <div className={styles.editorContainer}>
      {/* SIDEBAR */}
      <div className={styles.sidebar}>
        {/* Mode Selector */}
        <div className={styles.modeSection}>
          <label className={styles.modeLabel}>Mode</label>
          <select 
            className={styles.modeSelect}
            value={mode}
            onChange={handleModeChange}
          >
            <option value="read">Read</option>
            <option value="write">Write</option>
          </select>
        </div>

        {mode === 'write' ? (
          /* WRITE MODE */
          <div className={styles.sidebarContent}>
            {/* Formatting Section */}
            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Formatting</label>
              <div className={styles.formattingGrid}>
                <button 
                  tabIndex={-1}
                  className={`${styles.formattingOption} ${isBold ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={handleBoldClick}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  B
                </button>
                <button 
                  tabIndex={-1}
                  className={`${styles.formattingOption} ${isItalic ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={handleItalicClick}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  I
                </button>
                <button 
                  tabIndex={-1}
                  className={`${styles.formattingOption} ${isStrikethrough ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={handleStrikeClick}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  S
                </button>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Font</label>
              <select 
                className={styles.sidebarSelect}
                value={fontFamily}
                onChange={handleFontChange}
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Size</label>
              <div className={styles.sizeInputContainer}>
                <input 
                  type="text" 
                  value={displayFontSize}
                  onChange={handleFontSizeChange}
                  onBlur={handleFontSizeBlur}
                  className={styles.sizeInput}
                  maxLength={2}
                />
                <span className={styles.sizeUnit}>px</span>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Color</label>
              <div className={styles.colorPicker}>
                <div 
                  className={styles.colorPreviewContainer}
                  onClick={() => document.getElementById('colorInput')?.click()}
                >
                  <div 
                    className={styles.colorPreview}
                    style={{ backgroundColor: textColor }}
                  />
                  <span className={styles.colorHex}>{textColor}</span>
                </div>
                <input 
                  id="colorInput"
                  type="color" 
                  value={textColor}
                  className={styles.colorInput}
                  onChange={handleColorChange}
                />
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Alignment</label>
              <div className={styles.alignmentGrid}>
                <button 
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${alignment === 'left' ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={(e) => handleAlignmentClick('left', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Left
                </button>
                <button 
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${alignment === 'center' ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={(e) => handleAlignmentClick('center', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Center
                </button>
                <button 
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${alignment === 'right' ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={(e) => handleAlignmentClick('right', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Right
                </button>
                <button 
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${alignment === 'justify' ? styles.activeFormatting : ''}`}
                  type="button"
                  onClick={(e) => handleAlignmentClick('justify', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Justify
                </button>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Lists</label>
              <div className={styles.listGrid}>
                <button 
                  tabIndex={-1}
                  className={`${styles.listOption} ${isBulletList ? styles.activeList : ''}`}
                  type="button"
                  onClick={(e) => handleListClick('bullets', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  • Bullets
                </button>
                <button 
                  tabIndex={-1}
                  className={`${styles.listOption} ${isOrderedList ? styles.activeList : ''}`}
                  type="button"
                  onClick={(e) => handleListClick('numbers', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  1. Numbers
                </button>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>Insert</label>
              <div className={styles.insertGrid}>
                <button 
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  onClick={(e) => handleInsertClick('columns', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Columns
                </button>
                <button 
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  onClick={(e) => handleInsertClick('rows', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Rows
                </button>
                <button 
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  onClick={(e) => handleInsertClick('table', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Table
                </button>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>File Options</label>
              <div className={styles.fileGrid}>
                <button 
                  tabIndex={-1}
                  className={styles.fileOption}
                  type="button"
                  onClick={(e) => handleFileOptionClick('save', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Save
                </button>
                <button 
                  tabIndex={-1}
                  className={styles.fileOption}
                  type="button"
                  onClick={(e) => handleFileOptionClick('home', e)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* READ MODE */
          <div className={styles.sidebarContent}>
            <div className={styles.pagesList}>
              <label className={styles.sidebarLabel}>Pages</label>
              <div className={styles.pagesScroll}>
                {pages.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.pageItem} ${p.id === page.id ? styles.activePage : ''}`}
                    onClick={() => handlePageClick(p.id)}
                    type="button"
                  >
                    • {p.title || 'Untitled Page'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div 
        className={styles.mainContent} 
        ref={editorContainerRef}
      >
        <div className={styles.documentArea}>
          <div className={styles.paper}>
            <input 
              defaultValue={page.title} 
              className={styles.titleInput}
              placeholder="Page Title"
              onChange={handlePageTitleChange}
            />
            
            <div className={styles.contentArea}>
              <TiptapEditor 
                content={page.content} 
                onUpdate={handleContentUpdate}
              />
            </div>
          </div>
        </div>

        <div className={styles.navigation}>
          <button 
            tabIndex={-1}
            className={`${styles.navArrow} navArrow`}
            onClick={handlePreviousPage}
            disabled={!hasPreviousPage}
            style={{ opacity: hasPreviousPage ? 1 : 0.3 }}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
          >
            ‹
          </button>
          <button 
            tabIndex={-1}
            className={`${styles.navArrow} navArrow`}
            onClick={handleNextPage}
            disabled={!hasNextPage}
            style={{ opacity: hasNextPage ? 1 : 0.3 }}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}