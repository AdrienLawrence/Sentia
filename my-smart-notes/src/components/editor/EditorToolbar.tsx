// src/components/editor/EditorToolbar.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useEditorStore } from './useEditorStore'

interface EditorToolbarProps {
  editor: any
}

export function EditorToolbar({
  editor
}: EditorToolbarProps) {
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
    textColor,
    alignment,
    fontSize,
    fontFamily,

    setBold,
    setItalic,
    setStrikethrough,
    setBulletList,
    setOrderedList,
    setTextColor,
    setAlignment,
    setFontSize,
    setFontFamily
  } = useEditorStore()

  useEffect(() => {
    if (!editor) return

    const updateStoreFromEditor = () => {
      try {
        const { from, to } = editor.state.selection
        savedSelectionRef.current = { from, to }

        setBold(editor.isActive('bold'))
        setItalic(editor.isActive('italic'))
        setStrikethrough(
          editor.isActive('strike')
        )

        setBulletList(
          editor.isActive('bulletList')
        )

        setOrderedList(
          editor.isActive('orderedList')
        )

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

        setAlignment(currentAlignment)

        const textStyleAttributes =
          editor.getAttributes('textStyle') || {}

        if (textStyleAttributes.color) {
          setTextColor(
            textStyleAttributes.color
          )
        }

        setFontSize(
          textStyleAttributes.fontSize || '16px'
        )

        setFontFamily(
          !textStyleAttributes.fontFamily ||
            textStyleAttributes.fontFamily === 'Consolas'
            ? 'var(--font-roboto-condensed)'
            : textStyleAttributes.fontFamily
        )
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
    setBold,
    setItalic,
    setStrikethrough,
    setBulletList,
    setOrderedList,
    setTextColor,
    setAlignment,
    setFontSize,
    setFontFamily
  ])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, isBold])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, isItalic])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, isStrikethrough])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, alignment])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, textColor])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, isBulletList])

  useEffect(() => {
    if (!editor) return

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
  }, [editor, isOrderedList])

  useEffect(() => {
    if (!editor || !fontSize) return

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
  }, [editor, fontSize])

  useEffect(() => {
    if (!editor || !fontFamily) return

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
  }, [editor, fontFamily])

  return null
}
