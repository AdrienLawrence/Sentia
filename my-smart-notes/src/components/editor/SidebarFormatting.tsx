// src/components/editor/SidebarFormatting.tsx
'use client'

import { useEditorStore } from './useEditorStore'

export function SidebarFormatting() {
  const {
    isBold,
    isItalic,
    isStrikethrough,
    isBulletList,
    isOrderedList,
    setBold,
    setItalic,
    setStrikethrough,
    setBulletList,
    setOrderedList,
  } = useEditorStore()

  return (
    <>
      {/* Text Formatting Section */}
      <div className="sidebarSection">
        <label className="sidebarLabel">Formatting</label>
        <div className="formattingGrid">
          <button 
            className={`formattingOption ${isBold ? 'activeFormatting' : ''}`}
            type="button"
            onClick={() => setBold(!isBold)}
          >
            <span className="font-bold">B</span>
          </button>
          <button 
            className={`formattingOption ${isItalic ? 'activeFormatting' : ''}`}
            type="button"
            onClick={() => setItalic(!isItalic)}
          >
            <span className="italic">I</span>
          </button>
          <button 
            className={`formattingOption ${isStrikethrough ? 'activeFormatting' : ''}`}
            type="button"
            onClick={() => setStrikethrough(!isStrikethrough)}
          >
            <span className="line-through">S</span>
          </button>
        </div>
      </div>

      {/* Lists Section */}
      <div className="sidebarSection">
        <label className="sidebarLabel">Lists</label>
        <div className="listGrid">
          <button 
            className={`listOption ${isBulletList ? 'activeList' : ''}`}
            type="button"
            onClick={() => setBulletList(!isBulletList)}
          >
            • Bullets
          </button>
          <button 
            className={`listOption ${isOrderedList ? 'activeList' : ''}`}
            type="button"
            onClick={() => setOrderedList(!isOrderedList)}
          >
            1. Numbers
          </button>
        </div>
      </div>
    </>
  )
}