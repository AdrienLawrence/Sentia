// src/components/editor/EditorCore.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { useEditorStore } from './useEditorStore'
import { useEffect } from 'react'

interface EditorCoreProps {
  content?: any
  onUpdate?: (content: any) => void
}

export function EditorCore({ content, onUpdate }: EditorCoreProps) {
  const {
    // State
    isBold,
    isItalic, 
    isUnderline,
    isStrikethrough,
    alignment,
    textColor,
    isBulletList,
    isOrderedList,
    fontSize,
    fontFamily,
    hasSelection,
    canUndo,
    canRedo,
    
    // Actions
    setBold,
    setItalic,
    setUnderline,
    setStrikethrough,
    setAlignment,
    setTextColor,
    setBulletList,
    setOrderedList,
    setFontSize,
    setFontFamily,
    setHasSelection,
    setCanUndo,
    setCanRedo,
  } = useEditorStore()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the ones we'll control manually to avoid conflicts
        bold: false,
        italic: false,
        strike: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Color,
      TextStyle,
    ],
    content: content || '<p>Start typing...</p>',
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON())
      
      // Update store with current editor state for visual feedback
      setBold(editor.isActive('bold'))
      setItalic(editor.isActive('italic'))
      setStrikethrough(editor.isActive('strike'))
      setUnderline(editor.isActive('underline'))
      
      // Detect alignment
      const currentAlign = editor.isActive({ textAlign: 'left' }) ? 'left' : 
                          editor.isActive({ textAlign: 'center' }) ? 'center' :
                          editor.isActive({ textAlign: 'right' }) ? 'right' : 'justify'
      setAlignment(currentAlign)
      
      setBulletList(editor.isActive('bulletList'))
      setOrderedList(editor.isActive('orderedList'))
      setHasSelection(!editor.state.selection.empty)
      setCanUndo(editor.can().undo())
      setCanRedo(editor.can().redo())
      
      // Get current text color
      const currentColor = editor.getAttributes('textStyle').color
      if (currentColor) {
        setTextColor(currentColor)
      }
    },
    onSelectionUpdate: ({ editor }) => {
      setHasSelection(!editor.state.selection.empty)
      setCanUndo(editor.can().undo())
      setCanRedo(editor.can().redo())
    },
  })

  // Apply bold formatting when store changes
  useEffect(() => {
    if (!editor) return

    // Only apply if there's a mismatch between store and editor state
    if (editor.isActive('bold') !== isBold) {
      if (isBold) {
        editor.chain().focus().setBold().run()
      } else {
        editor.chain().focus().unsetBold().run()
      }
    }
  }, [editor, isBold])

  // Apply italic formatting
  useEffect(() => {
    if (!editor) return

    if (editor.isActive('italic') !== isItalic) {
      if (isItalic) {
        editor.chain().focus().setItalic().run()
      } else {
        editor.chain().focus().unsetItalic().run()
      }
    }
  }, [editor, isItalic])

  // Apply underline formatting
  useEffect(() => {
    if (!editor) return

    if (editor.isActive('underline') !== isUnderline) {
      if (isUnderline) {
        editor.chain().focus().setUnderline().run()
      } else {
        editor.chain().focus().unsetUnderline().run()
      }
    }
  }, [editor, isUnderline])

  // Apply strikethrough formatting
  useEffect(() => {
    if (!editor) return

    if (editor.isActive('strike') !== isStrikethrough) {
      if (isStrikethrough) {
        editor.chain().focus().setStrike().run()
      } else {
        editor.chain().focus().unsetStrike().run()
      }
    }
  }, [editor, isStrikethrough])

  // Apply text alignment
  useEffect(() => {
    if (!editor) return

    if (!editor.isActive({ textAlign: alignment })) {
      editor.chain().focus().setTextAlign(alignment).run()
    }
  }, [editor, alignment])

  // Apply text color
  useEffect(() => {
    if (!editor) return

    const currentColor = editor.getAttributes('textStyle').color
    if (currentColor !== textColor) {
      editor.chain().focus().setColor(textColor).run()
    }
  }, [editor, textColor])

  // Apply bullet list
  useEffect(() => {
    if (!editor) return

    if (editor.isActive('bulletList') !== isBulletList) {
      editor.chain().focus().toggleBulletList().run()
    }
  }, [editor, isBulletList])

  // Apply ordered list
  useEffect(() => {
    if (!editor) return

    if (editor.isActive('orderedList') !== isOrderedList) {
      editor.chain().focus().toggleOrderedList().run()
    }
  }, [editor, isOrderedList])

  if (!editor) {
    return <div className="flex items-center justify-center min-h-[500px] text-gray-500">Loading editor...</div>
  }

  return (
    <EditorContent 
      editor={editor} 
      className="flex-1 overflow-y-auto p-8 focus:outline-none min-h-[500px]"
    />
  )
}