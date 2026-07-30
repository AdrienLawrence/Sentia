// src/components/editor/useEditorStore.ts
import { create } from 'zustand'

interface EditorState {
  // Formatting state
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikethrough: boolean
  
  // Text alignment
  alignment: 'left' | 'center' | 'right' | 'justify'
  
  // Text color
  textColor: string
  
  // Lists
  isBulletList: boolean
  isOrderedList: boolean
  isCodeBlock: boolean
  
  // Font
  fontSize: string
  fontFamily: string
  
  // Selection state
  hasSelection: boolean
  canUndo: boolean
  canRedo: boolean
  
  // Actions to update state
  setBold: (bold: boolean) => void
  setItalic: (italic: boolean) => void
  setUnderline: (underline: boolean) => void
  setStrikethrough: (strikethrough: boolean) => void
  setAlignment: (alignment: 'left' | 'center' | 'right' | 'justify') => void
  setTextColor: (color: string) => void
  setBulletList: (active: boolean) => void
  setOrderedList: (active: boolean) => void
  setCodeBlock: (active: boolean) => void
  setFontSize: (size: string) => void
  setFontFamily: (family: string) => void
  setHasSelection: (hasSelection: boolean) => void
  setCanUndo: (canUndo: boolean) => void
  setCanRedo: (canRedo: boolean) => void
  syncFormatting: (formatting: {
    isBold: boolean
    isItalic: boolean
    isStrikethrough: boolean
    isBulletList: boolean
    isOrderedList: boolean
    isCodeBlock: boolean
    textColor: string
    alignment: 'left' | 'center' | 'right' | 'justify'
    fontSize: string
    fontFamily: string
  }) => void
  
  // Reset all formatting to defaults
  resetFormatting: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  // Initial state
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  alignment: 'left',
  textColor: '#000000',
  isBulletList: false,
  isOrderedList: false,
  isCodeBlock: false,
  fontSize: '16px',
  fontFamily: 'var(--font-roboto-condensed)',
  hasSelection: false,
  canUndo: false,
  canRedo: false,

  // Actions
  setBold: (isBold) => set({ isBold }),
  setItalic: (isItalic) => set({ isItalic }),
  setUnderline: (isUnderline) => set({ isUnderline }),
  setStrikethrough: (isStrikethrough) => set({ isStrikethrough }),
  setAlignment: (alignment) => set({ alignment }),
  setTextColor: (textColor) => set({ textColor }),
  setBulletList: (isBulletList) => set({ isBulletList }),
  setOrderedList: (isOrderedList) => set({ isOrderedList }),
  setCodeBlock: (isCodeBlock) => set({ isCodeBlock }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setHasSelection: (hasSelection) => set({ hasSelection }),
  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),
  syncFormatting: (formatting) =>
    set((state) => {
      const unchanged =
        state.isBold === formatting.isBold &&
        state.isItalic === formatting.isItalic &&
        state.isStrikethrough === formatting.isStrikethrough &&
        state.isBulletList === formatting.isBulletList &&
        state.isOrderedList === formatting.isOrderedList &&
        state.isCodeBlock === formatting.isCodeBlock &&
        state.textColor === formatting.textColor &&
        state.alignment === formatting.alignment &&
        state.fontSize === formatting.fontSize &&
        state.fontFamily === formatting.fontFamily

      return unchanged ? state : formatting
    }),
  
  resetFormatting: () => set({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    alignment: 'left',
    textColor: '#000000',
    isBulletList: false,
    isOrderedList: false,
    isCodeBlock: false,
    fontSize: '16px',
    fontFamily: 'var(--font-roboto-condensed)',
  }),
}))
