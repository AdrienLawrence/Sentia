// src/components/editor/EditorToolbar.tsx
'use client'

import { useEffect } from 'react'
import { useEditorStore } from './useEditorStore'
import { ListManager } from './listManager'

interface EditorToolbarProps {
  editor: any // Tiptap editor instance
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const {
    // STATE
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

  // Sync store with editor state when editor changes
  useEffect(() => {
    if (!editor) {
      console.log('EditorToolbar: No editor instance')
      return
    }

    console.log('EditorToolbar: Setting up listeners for editor')

    const updateStoreFromEditor = () => {
      try {
        // Update ALL formatting states from editor
        setBold(editor.isActive('bold'))
        setItalic(editor.isActive('italic'))
        setStrikethrough(editor.isActive('strike'))
        
        // Check for lists using ListManager - USE CORRECT METHOD NAMES
        const listManager = new ListManager(editor)
        setBulletList(listManager.isInBulletListAtCursor())  // CORRECTED
        setOrderedList(listManager.isInNumberedListAtCursor()) // CORRECTED
        
        // Text alignment
        const currentAlign = editor.isActive({ textAlign: 'left' }) ? 'left' :
                            editor.isActive({ textAlign: 'center' }) ? 'center' :
                            editor.isActive({ textAlign: 'right' }) ? 'right' : 'justify'
        setAlignment(currentAlign)
        
        // Text color
        const currentColor = editor.getAttributes('textStyle')?.color
        if (currentColor) {
          setTextColor(currentColor)
        }
        
        // Font size
        const currentFontSize = editor.getAttributes('textStyle')?.fontSize
        if (currentFontSize) {
          setFontSize(currentFontSize)
        }
        
        // Font family
        const currentFontFamily = editor.getAttributes('textStyle')?.fontFamily
        if (currentFontFamily) {
          setFontFamily(currentFontFamily)
        }
        
      } catch (error) {
        console.error('EditorToolbar: Error updating store from editor:', error)
      }
    }

    // Listen to editor changes
    editor.on('transaction', updateStoreFromEditor)
    editor.on('selectionUpdate', updateStoreFromEditor)
    
    console.log('EditorToolbar: Listeners attached')

    // Initial update
    updateStoreFromEditor()

    return () => {
      console.log('EditorToolbar: Cleaning up listeners')
      editor.off('transaction', updateStoreFromEditor)
      editor.off('selectionUpdate', updateStoreFromEditor)
    }
  }, [editor, setBold, setItalic, setStrikethrough, setBulletList, setOrderedList, setTextColor, setAlignment, setFontSize, setFontFamily])

  // Apply bold formatting when store changes
  useEffect(() => {
    if (!editor) return
    
    if (editor.isActive('bold') !== isBold) {
      try {
        if (isBold) {
          editor.chain().focus().setBold().run()
        } else {
          editor.chain().focus().unsetBold().run()
        }
      } catch (error) {
        console.error('EditorToolbar: Error applying bold:', error)
      }
    }
  }, [editor, isBold])

  // Apply italic formatting
  useEffect(() => {
    if (!editor) return
    
    if (editor.isActive('italic') !== isItalic) {
      try {
        if (isItalic) {
          editor.chain().focus().setItalic().run()
        } else {
          editor.chain().focus().unsetItalic().run()
        }
      } catch (error) {
        console.error('EditorToolbar: Error applying italic:', error)
      }
    }
  }, [editor, isItalic])

  // Apply strikethrough formatting
  useEffect(() => {
    if (!editor) return

    if (editor.isActive('strike') !== isStrikethrough) {
      try {
        if (isStrikethrough) {
          editor.chain().focus().setStrike().run()
        } else {
          editor.chain().focus().unsetStrike().run()
        }
      } catch (error) {
        console.error('EditorToolbar: Error applying strikethrough:', error)
      }
    }
  }, [editor, isStrikethrough])

  // Apply text alignment
  useEffect(() => {
    if (!editor) return
    
    try {
      if (!editor.isActive({ textAlign: alignment })) {
        editor.chain().focus().setTextAlign(alignment).run()
      }
    } catch (error) {
      console.error('EditorToolbar: Error applying alignment:', error)
    }
  }, [editor, alignment])

  // Apply text color
  useEffect(() => {
    if (!editor) return
    
    try {
      const currentColor = editor.getAttributes('textStyle')?.color
      if (currentColor !== textColor) {
        editor.chain().focus().setColor(textColor).run()
      }
    } catch (error) {
      console.error('EditorToolbar: Error applying text color:', error)
    }
  }, [editor, textColor])

  // Apply bullet list using ListManager - USE CORRECT METHOD NAMES
  useEffect(() => {
    if (!editor) return
    
    try {
      const listManager = new ListManager(editor)
      
      if (isBulletList) {
        listManager.createBulletList()
      } else {
        // Only exit if we're actually in a bullet list - USE CORRECT METHOD NAME
        if (listManager.isInBulletListAtCursor()) {
          listManager.exitBulletListAtCursor()  // CORRECTED
        }
      }
    } catch (error) {
      console.error('EditorToolbar: Error with bullet list:', error)
    }
  }, [editor, isBulletList])

  // Apply ordered list using ListManager - USE CORRECT METHOD NAMES
  useEffect(() => {
    if (!editor) return
    
    try {
      const listManager = new ListManager(editor)
      
      if (isOrderedList) {
        listManager.createNumberedList()
      } else {
        // Only exit if we're actually in a numbered list - USE CORRECT METHOD NAME
        if (listManager.isInNumberedListAtCursor()) {
          listManager.exitNumberedListAtCursor()  // CORRECTED
        }
      }
    } catch (error) {
      console.error('EditorToolbar: Error with ordered list:', error)
    }
  }, [editor, isOrderedList])

  // Apply font size
  useEffect(() => {
    if (!editor || !fontSize) return
    
    try {
      const currentFontSize = editor.getAttributes('textStyle')?.fontSize
      if (currentFontSize !== fontSize) {
        // Set font size through textStyle mark
        editor.chain().focus().setMark('textStyle', { fontSize }).run()
      }
    } catch (error) {
      console.error('EditorToolbar: Error applying font size:', error)
    }
  }, [editor, fontSize])

  // Apply font family
  useEffect(() => {
    if (!editor || !fontFamily) return
    
    try {
      const currentFontFamily = editor.getAttributes('textStyle')?.fontFamily
      if (currentFontFamily !== fontFamily) {
        // Set font family through textStyle mark
        editor.chain().focus().setMark('textStyle', { fontFamily }).run()
      }
    } catch (error) {
      console.error('EditorToolbar: Error applying font family:', error)
    }
  }, [editor, fontFamily])

  return null
}