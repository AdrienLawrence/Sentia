// src/components/TiptapEditor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor, JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import {
  FontFamily,
  FontSize,
  TextStyle
} from '@tiptap/extension-text-style'
import { EditorToolbar } from './editor/EditorToolbar'
import ListManager from './editor/listManager'
import { useEffect, useRef, useState } from 'react'
import {
  markdownToTiptapDocument
} from '@/features/file-transfer/lib/content'

interface EditorInsertRequest {
  id: string
  text: string
}

interface EditorHighlightRequest {
  id: string
  text: string
}

interface EditorSelectionSnapshot {
  from: number
  to: number
  text: string
}

interface EditorReplaceRequest {
  id: string
  sourceMessageId: string
  target: 'page' | 'selection'
  text?: string
  content?: JSONContent
  selection?: EditorSelectionSnapshot
}

interface TiptapEditorProps {
  content?: JSONContent
  onUpdate?: (content: JSONContent) => void
  editable?: boolean
  highlightRequest?: EditorHighlightRequest | null
  insertRequest?: EditorInsertRequest | null
  replaceRequest?: EditorReplaceRequest | null
  onSelectionChange?: (
    selection: EditorSelectionSnapshot | null
  ) => void
  onReplaceResult?: (
    sourceMessageId: string,
    applied: boolean
  ) => void
}

function textToParagraphs(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }]
    }))
}

function getSelectedTextBlocks(editor: Editor) {
  const { doc, selection } = editor.state

  if (selection.empty) {
    return [
      {
        start: selection.$from.start(),
        text: selection.$from.parent.textContent
      }
    ]
  }

  const blocks: Array<{ start: number; text: string }> = []

  doc.nodesBetween(
    selection.from,
    selection.to,
    (node, position) => {
      if (node.isTextblock) {
        blocks.push({
          start: position + 1,
          text: node.textContent
        })
      }
    }
  )

  return blocks
}

function findTextSelection(editor: Editor, searchText: string) {
  const normalizedSearch = searchText
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalizedSearch) return null

  const characters: string[] = []
  const positions: Array<{ from: number; to: number }> = []

  const appendCharacter = (
    character: string,
    from: number,
    to: number
  ) => {
    const normalizedCharacter = /\s/.test(character)
      ? ' '
      : character

    if (
      normalizedCharacter === ' ' &&
      characters[characters.length - 1] === ' '
    ) {
      positions[positions.length - 1].to = to
      return
    }

    characters.push(normalizedCharacter)
    positions.push({ from, to })
  }

  editor.state.doc.descendants((node, position) => {
    if (!node.isTextblock) return

    if (characters.length > 0) {
      appendCharacter(' ', position, position + 1)
    }

    node.descendants((child, childPosition) => {
      if (child.isText && child.text) {
        for (let index = 0; index < child.text.length; index += 1) {
          const character = child.text[index]
          const from = position + 1 + childPosition + index
          appendCharacter(character, from, from + 1)
        }
      } else if (child.type.name === 'hardBreak') {
        const from = position + 1 + childPosition
        appendCharacter(' ', from, from + child.nodeSize)
      }
    })
  })

  const normalizedDocument = characters.join('')
  let search = normalizedSearch
  let start = normalizedDocument.indexOf(search)

  while (start === -1 && search.length > 80) {
    search = search.slice(0, Math.floor(search.length * 0.75)).trim()
    start = normalizedDocument.indexOf(search)
  }

  if (start === -1) return null

  const end = start + search.length - 1
  return {
    from: positions[start].from,
    to: positions[end].to
  }
}

function indentSelection(editor: Editor) {
  const { selection } = editor.state

  if (selection.empty) {
    return editor
      .chain()
      .focus()
      .insertContent('\t')
      .run()
  }

  const transaction = editor.state.tr

  getSelectedTextBlocks(editor)
    .sort((left, right) => right.start - left.start)
    .forEach(({ start }) => {
      transaction.insertText('\t', start)
    })

  editor.view.dispatch(transaction)
  return true
}

function outdentSelection(editor: Editor) {
  const transaction = editor.state.tr
  let changed = false

  getSelectedTextBlocks(editor)
    .sort((left, right) => right.start - left.start)
    .forEach(({ start, text }) => {
      const indentation = text.match(/^(?:\t| {1,4})/)

      if (!indentation) return

      transaction.delete(
        start,
        start + indentation[0].length
      )
      changed = true
    })

  if (changed) {
    editor.view.dispatch(transaction)
  }

  editor.commands.focus()
  return true
}

export function TiptapEditor({
  content,
  onUpdate,
  editable = true,
  highlightRequest,
  insertRequest,
  replaceRequest,
  onSelectionChange,
  onReplaceResult
}: TiptapEditorProps) {
  const [isMounted, setIsMounted] = useState(false)
  const lastInsertRequestIdRef = useRef<string | null>(null)
  const lastHighlightRequestIdRef = useRef<string | null>(null)
  const lastReplaceRequestIdRef = useRef<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Color,
      TextStyle,
      FontSize,
      FontFamily,
    ],
    content: content || '<p>Start typing...</p>',
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection

      onSelectionChange?.(
        empty
          ? null
          : {
              from,
              to,
              text: editor.state.doc.textBetween(
                from,
                to,
                '\n'
              )
            }
      )
    },
    editable,
    immediatelyRender: false,
  })

  useEffect(() => {
    if (
      !editor ||
      !highlightRequest ||
      lastHighlightRequestIdRef.current === highlightRequest.id
    ) {
      return
    }

    lastHighlightRequestIdRef.current = highlightRequest.id
    const selection = findTextSelection(
      editor,
      highlightRequest.text
    )

    if (!selection) return

    editor
      .chain()
      .focus()
      .setTextSelection(selection)
      .scrollIntoView()
      .run()
  }, [editor, highlightRequest])

  useEffect(() => {
    if (
      !editor ||
      !insertRequest ||
      lastInsertRequestIdRef.current === insertRequest.id
    ) {
      return
    }

    const paragraphs = textToParagraphs(insertRequest.text)

    if (paragraphs.length === 0) return

    lastInsertRequestIdRef.current = insertRequest.id
    editor
      .chain()
      .focus('end')
      .insertContent(paragraphs)
      .run()
  }, [editor, insertRequest])

  useEffect(() => {
    if (
      !editor ||
      !replaceRequest ||
      lastReplaceRequestIdRef.current === replaceRequest.id
    ) {
      return
    }

    lastReplaceRequestIdRef.current = replaceRequest.id
    const replacementContent =
      replaceRequest.content ??
      markdownToTiptapDocument(replaceRequest.text ?? '')
    const replacementNodes = replacementContent.content ?? []

    if (
      replaceRequest.target === 'selection' &&
      replacementNodes.length === 0
    ) {
      onReplaceResult?.(replaceRequest.sourceMessageId, false)
      return
    }

    if (replaceRequest.target === 'selection') {
      const selection = replaceRequest.selection

      if (
        !selection ||
        editor.state.doc.textBetween(
          selection.from,
          selection.to,
          '\n'
        ) !== selection.text
      ) {
        onReplaceResult?.(
          replaceRequest.sourceMessageId,
          false
        )
        return
      }

      editor
        .chain()
        .focus()
        .setTextSelection({
          from: selection.from,
          to: selection.to
        })
        .insertContent(replacementNodes)
        .run()
    } else {
      editor
        .chain()
        .focus()
        .setContent(
          replacementNodes.length > 0
            ? replacementContent
            : {
                type: 'doc',
                content: [{ type: 'paragraph' }]
              }
        )
        .run()
    }

    onReplaceResult?.(replaceRequest.sourceMessageId, true)
  }, [editor, onReplaceResult, replaceRequest])

  // Add keyboard handlers for lists
  useEffect(() => {
    if (!editor) return
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const listManager = new ListManager(editor)

      if (
        event.key === ' ' &&
        listManager.handleRomanListShortcut()
      ) {
        event.preventDefault()
        return
      }
      
      // Handle Enter key for lists
      if (event.key === 'Enter') {
        if (listManager.handleEnterInList()) {
          event.preventDefault()
          return
        }
      }
      
    }
    
    // Get the editor's DOM element and add listener
    const editorElement = editor.view.dom
    editorElement.addEventListener('keydown', handleKeyDown)
    
    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor])

  if (!isMounted) {
    return <div className="flex items-center justify-center min-h-[500px] text-gray-500">Loading editor...</div>
  }

  if (!editor) {
    return <div className="flex items-center justify-center min-h-[500px] text-gray-500">Initializing editor...</div>
  }

  return (
    <>
      <EditorToolbar editor={editor} />
      <EditorContent 
        editor={editor} 
        className="flex-1 overflow-y-auto focus:outline-none min-h-[500px]"
        onKeyDownCapture={(event) => {
          if (event.key !== 'Tab') return

          event.preventDefault()
          event.stopPropagation()

          const listManager = new ListManager(editor)

          if (editor.isActive('listItem')) {
            if (event.shiftKey) {
              listManager.handleShiftTab()
            } else {
              listManager.handleTab()
            }

            return
          }

          if (event.shiftKey) {
            outdentSelection(editor)
          } else {
            indentSelection(editor)
          }
        }}
      />
    </>
  )
}
