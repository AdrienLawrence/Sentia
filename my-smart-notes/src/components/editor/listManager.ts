// src/components/editor/listManager.ts
export class ListManager {
  private editor: any
  
  constructor(editor: any) {
    this.editor = editor
  }
  
  // Create bullet list
  createBulletList() {
    if (!this.editor) return
    
    // Check if we're already in a bullet list at cursor position
    if (this.isInBulletListAtCursor()) {
      this.exitBulletListAtCursor()
      return
    }
    
    // Insert bullet at cursor position
    this.editor.chain().focus().insertContent('• ').run()
  }
  
  // Create numbered list
  createNumberedList() {
    if (!this.editor) return
    
    // Check if we're already in a numbered list at cursor position
    if (this.isInNumberedListAtCursor()) {
      this.exitNumberedListAtCursor()
      return
    }
    
    // Insert "1. " at cursor position
    this.editor.chain().focus().insertContent('1. ').run()
  }
  
  // Check if cursor is in bullet list by looking at text around cursor
  isInBulletListAtCursor(): boolean {
    if (!this.editor) return false
    
    const { from } = this.editor.state.selection
    const textBefore = this.getTextBeforeCursor(20) // Look 20 chars before cursor
    
    // Check if we have "• " in the text before cursor on the same line
    const lines = textBefore.split('\n')
    const currentLine = lines[lines.length - 1]
    
    return currentLine.includes('• ')
  }
  
  // Check if cursor is in numbered list by looking at text around cursor
  isInNumberedListAtCursor(): boolean {
    if (!this.editor) return false
    
    const { from } = this.editor.state.selection
    const textBefore = this.getTextBeforeCursor(30) // Look 30 chars before cursor
    
    // Check if we have "X. " in the text before cursor on the same line
    const lines = textBefore.split('\n')
    const currentLine = lines[lines.length - 1]
    
    return /\d+\.\s/.test(currentLine)
  }
  
  // Get text before cursor
  private getTextBeforeCursor(chars: number): string {
    if (!this.editor) return ''
    
    const { from } = this.editor.state.selection
    const start = Math.max(0, from - chars)
    return this.editor.state.doc.textBetween(start, from, '\n')
  }
  
  // Get current line text around cursor
  private getCurrentLineText(): string {
    if (!this.editor) return ''
    
    const { from } = this.editor.state.selection
    const doc = this.editor.state.doc
    
    // Find line start
    let lineStart = from
    while (lineStart > 0 && doc.textBetween(lineStart - 1, lineStart) !== '\n') {
      lineStart--
    }
    
    // Find line end
    let lineEnd = from
    const docSize = doc.content.size
    while (lineEnd < docSize && doc.textBetween(lineEnd, lineEnd + 1) !== '\n') {
      lineEnd++
    }
    
    return doc.textBetween(lineStart, lineEnd)
  }
  
  // Exit bullet list at cursor position
  exitBulletListAtCursor() {
    if (!this.editor) return
    
    const lineText = this.getCurrentLineText()
    const bulletIndex = lineText.indexOf('• ')
    
    if (bulletIndex !== -1) {
      const { from } = this.editor.state.selection
      const lineStart = this.findLineStart(from)
      const deleteFrom = lineStart + bulletIndex
      const deleteTo = deleteFrom + 2 // "• " is 2 chars
      
      this.editor.chain().focus()
        .setTextSelection(deleteTo)
        .deleteRange({ from: deleteFrom, to: deleteTo })
        .run()
    }
  }
  
  // Exit numbered list at cursor position
  exitNumberedListAtCursor() {
    if (!this.editor) return
    
    const lineText = this.getCurrentLineText()
    const match = lineText.match(/(\d+\.\s)/)
    
    if (match) {
      const numberText = match[1]
      const numberIndex = lineText.indexOf(numberText)
      
      const { from } = this.editor.state.selection
      const lineStart = this.findLineStart(from)
      const deleteFrom = lineStart + numberIndex
      const deleteTo = deleteFrom + numberText.length
      
      this.editor.chain().focus()
        .setTextSelection(deleteTo)
        .deleteRange({ from: deleteFrom, to: deleteTo })
        .run()
    }
  }
  
  // Find start of line containing position
  private findLineStart(position: number): number {
    if (!this.editor) return position
    
    const doc = this.editor.state.doc
    let lineStart = position
    
    while (lineStart > 0 && doc.textBetween(lineStart - 1, lineStart) !== '\n') {
      lineStart--
    }
    
    return lineStart
  }
  
  // Handle Enter key - check if we should create new list item
  shouldHandleEnter(): boolean {
    if (!this.editor) return false
    
    const { from } = this.editor.state.selection
    const lineText = this.getCurrentLineText()
    const lineStart = this.findLineStart(from)
    const isAtLineStart = from === lineStart
    
    // Check if we're at line start and line starts with list marker
    if (isAtLineStart) {
      return lineText.startsWith('• ') || /^\d+\.\s/.test(lineText)
    }
    
    return false
  }
  
  // Handle Enter in list - create new list item
  handleEnterInList(): boolean {
    if (!this.editor || !this.shouldHandleEnter()) return false
    
    const lineText = this.getCurrentLineText()
    
    if (lineText.startsWith('• ')) {
      // Create new bullet
      this.editor.chain().focus().insertContent('\n• ').run()
      return true
    }
    
    const match = lineText.match(/^(\d+)\.\s/)
    if (match) {
      const currentNumber = parseInt(match[1])
      const nextNumber = currentNumber + 1
      
      // Create new numbered item
      this.editor.chain().focus().insertContent(`\n${nextNumber}. `).run()
      return true
    }
    
    return false
  }
  
  // Handle Tab key for indentation
  handleTab(): boolean {
    if (!this.editor) return false
    
    const { from } = this.editor.state.selection
    const lineStart = this.findLineStart(from)
    const isAtLineStart = from === lineStart
    
    if (isAtLineStart && (this.isInBulletListAtCursor() || this.isInNumberedListAtCursor())) {
      // Add 2 spaces at line start (indentation)
      this.editor.chain().focus().insertContent('  ').run()
      return true
    }
    
    return false
  }
  
  // Handle Shift+Tab for outdentation
  handleShiftTab(): boolean {
    if (!this.editor) return false
    
    const { from } = this.editor.state.selection
    const lineStart = this.findLineStart(from)
    const lineText = this.getCurrentLineText()
    
    // Check if line starts with 2 spaces
    if (lineText.startsWith('  ')) {
      this.editor.chain().focus()
        .deleteRange({ from: lineStart, to: lineStart + 2 })
        .run()
      return true
    }
    
    return false
  }
}

// Export the class
export default ListManager