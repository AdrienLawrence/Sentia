// src/components/TiptapEditor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorToolbar } from './editor/EditorToolbar'
import ListManager from './editor/listManager'
import { useEffect, useState } from 'react'

interface TiptapEditorProps {
  content?: any
  onUpdate?: (content: any) => void
  editable?: boolean
}

export function TiptapEditor({ content, onUpdate, editable = true }: TiptapEditorProps) {
  const [isMounted, setIsMounted] = useState(false)

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
    ],
    content: content || '<p>Start typing...</p>',
    onUpdate: ({ editor }) => {
      console.log('TiptapEditor: onUpdate fired')
      onUpdate?.(editor.getJSON())
    },
    onSelectionUpdate: ({ editor }) => {
      console.log('TiptapEditor: onSelectionUpdate fired')
    },
    editable,
    immediatelyRender: false,
  })

  // Add keyboard handlers for lists
  useEffect(() => {
    if (!editor) return
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const listManager = new ListManager(editor)
      
      // Handle Enter key for lists
      if (event.key === 'Enter') {
        if (listManager.handleEnterInList()) {
          event.preventDefault()
          return
        }
      }
      
      // Handle Tab for indentation
      if (event.key === 'Tab' && !event.shiftKey) {
        if (listManager.handleTab()) {
          event.preventDefault()
          return
        }
      }
      
      // Handle Shift+Tab for outdentation
      if (event.key === 'Tab' && event.shiftKey) {
        if (listManager.handleShiftTab()) {
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

  // Log when editor is created
  useEffect(() => {
    if (editor) {
      console.log('TiptapEditor: Editor instance created')
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
      />
    </>
  )
}