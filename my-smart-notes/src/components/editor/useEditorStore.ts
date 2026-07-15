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
  setFontSize: (size: string) => void
  setFontFamily: (family: string) => void
  setHasSelection: (hasSelection: boolean) => void
  setCanUndo: (canUndo: boolean) => void
  setCanRedo: (canRedo: boolean) => void
  
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
  fontSize: '16px',
  fontFamily: 'Arial',
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
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setHasSelection: (hasSelection) => set({ hasSelection }),
  setCanUndo: (canUndo) => set({ canUndo }),
  setCanRedo: (canRedo) => set({ canRedo }),
  
  resetFormatting: () => set({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    alignment: 'left',
    textColor: '#000000',
    isBulletList: false,
    isOrderedList: false,
    fontSize: '16px',
    fontFamily: 'Arial',
  }),
}))