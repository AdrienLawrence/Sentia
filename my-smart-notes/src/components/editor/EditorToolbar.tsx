// src/components/editor/EditorToolbar.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorStore } from './useEditorStore'

interface EditorToolbarProps {
  editor: Editor
}

export function EditorToolbar({
  editor
}: EditorToolbarProps) {
  const [isInitialized, setIsInitialized] = useState(false)
  const savedSelectionRef = useRef<{
    from: number
    to: number
  } | null>(null)

  const {
    isBold,
    isItalic,
    isStrikethrough,
    isBulletList,
    isOrderedList,
    isCodeBlock,
    textColor,
    alignment,
    fontSize,
    fontFamily,

    syncFormatting
  } = useEditorStore()

  useEffect(() => {
    if (!editor) return

    const updateStoreFromEditor = () => {
      try {
        const { from, to } = editor.state.selection
        savedSelectionRef.current = { from, to }

        const currentAlignment =
          editor.isActive({
            textAlign: 'center'
          })
            ? 'center'
            : editor.isActive({
                  textAlign: 'right'
                })
              ? 'right'
              : editor.isActive({
                    textAlign: 'justify'
                  })
                ? 'justify'
                : 'left'

        const textStyleAttributes =
          editor.getAttributes('textStyle') || {}

        const currentFormatting = useEditorStore.getState()

        syncFormatting({
          isBold: editor.isActive('bold'),
          isItalic: editor.isActive('italic'),
          isStrikethrough: editor.isActive('strike'),
          isBulletList: editor.isActive('bulletList'),
          isOrderedList: editor.isActive('orderedList'),
          isCodeBlock: editor.isActive('codeBlock'),
          textColor:
            textStyleAttributes.color ||
            currentFormatting.textColor,
          alignment: currentAlignment,
          fontSize:
            textStyleAttributes.fontSize || '16px',
          fontFamily:
            !textStyleAttributes.fontFamily ||
            textStyleAttributes.fontFamily === 'Consolas'
              ? 'var(--font-roboto-condensed)'
              : textStyleAttributes.fontFamily
        })
      } catch (error) {
        console.error(
          'EditorToolbar: Failed to synchronize editor state:',
          error
        )
      }
    }

    editor.on(
      'transaction',
      updateStoreFromEditor
    )

    editor.on(
      'selectionUpdate',
      updateStoreFromEditor
    )

    updateStoreFromEditor()
    setIsInitialized(true)

    return () => {
      editor.off(
        'transaction',
        updateStoreFromEditor
      )

      editor.off(
        'selectionUpdate',
        updateStoreFromEditor
      )
    }
  }, [
    editor,
    syncFormatting
  ])

  useEffect(() => {
    if (!editor || !isInitialized) return

    if (
      editor.isActive('bold') === isBold
    ) {
      return
    }

    try {
      const chain = editor.chain().focus()

      if (isBold) {
        chain.setBold().run()
      } else {
        chain.unsetBold().run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply bold:',
        error
      )
    }
  }, [editor, isBold, isInitialized])

  useEffect(() => {
    if (!editor || !isInitialized) return

    if (
      editor.isActive('italic') ===
      isItalic
    ) {
      return
    }

    try {
      const chain = editor.chain().focus()

      if (isItalic) {
        chain.setItalic().run()
      } else {
        chain.unsetItalic().run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply italic:',
        error
      )
    }
  }, [editor, isInitialized, isItalic])

  useEffect(() => {
    if (!editor || !isInitialized) return

    if (
      editor.isActive('strike') ===
      isStrikethrough
    ) {
      return
    }

    try {
      const chain = editor.chain().focus()

      if (isStrikethrough) {
        chain.setStrike().run()
      } else {
        chain.unsetStrike().run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply strikethrough:',
        error
      )
    }
  }, [editor, isInitialized, isStrikethrough])

  useEffect(() => {
    if (!editor || !isInitialized) return

    if (
      editor.isActive('codeBlock') ===
      isCodeBlock
    ) {
      return
    }

    try {
      editor
        .chain()
        .focus()
        .toggleCodeBlock()
        .run()
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to toggle code block:',
        error
      )
    }
  }, [editor, isCodeBlock, isInitialized])

  useEffect(() => {
    if (!editor || !isInitialized) return

    try {
      if (
        !editor.isActive({
          textAlign: alignment
        })
      ) {
        editor
          .chain()
          .focus()
          .setTextAlign(alignment)
          .run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply alignment:',
        error
      )
    }
  }, [alignment, editor, isInitialized])

  useEffect(() => {
    if (!editor || !isInitialized) return

    try {
      const currentColor =
        editor.getAttributes(
          'textStyle'
        )?.color

      if (currentColor !== textColor) {
        editor
          .chain()
          .focus()
          .setColor(textColor)
          .run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply text color:',
        error
      )
    }
  }, [editor, isInitialized, textColor])

  useEffect(() => {
    if (!editor || !isInitialized) return

    const bulletListActive =
      editor.isActive('bulletList')

    if (
      bulletListActive === isBulletList
    ) {
      return
    }

    try {
      editor
        .chain()
        .focus()
        .toggleBulletList()
        .run()
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to toggle bullet list:',
        error
      )
    }
  }, [editor, isBulletList, isInitialized])

  useEffect(() => {
    if (!editor || !isInitialized) return

    const orderedListActive =
      editor.isActive('orderedList')

    if (
      orderedListActive === isOrderedList
    ) {
      return
    }

    try {
      editor
        .chain()
        .focus()
        .toggleOrderedList()
        .run()
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to toggle ordered list:',
        error
      )
    }
  }, [editor, isInitialized, isOrderedList])

  useEffect(() => {
    if (!editor || !fontSize || !isInitialized) return

    try {
      const currentFontSize =
        editor.getAttributes(
          'textStyle'
        )?.fontSize

      if (
        currentFontSize !== fontSize
      ) {
        const chain = editor.chain()
        const savedSelection = savedSelectionRef.current

        if (savedSelection) {
          chain.setTextSelection(savedSelection)
        }

        chain
          .focus()
          .setFontSize(fontSize)
          .run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply font size:',
        error
      )
    }
  }, [editor, fontSize, isInitialized])

  useEffect(() => {
    if (!editor || !fontFamily || !isInitialized) return

    try {
      const currentFontFamily =
        editor.getAttributes(
          'textStyle'
        )?.fontFamily

      if (
        currentFontFamily !== fontFamily
      ) {
        editor
          .chain()
          .focus()
          .setMark('textStyle', {
            fontFamily
          })
          .run()
      }
    } catch (error) {
      console.error(
        'EditorToolbar: Failed to apply font family:',
        error
      )
    }
  }, [editor, fontFamily, isInitialized])

  return null
}
