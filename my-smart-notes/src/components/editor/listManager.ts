// src/components/editor/listManager.ts

export class ListManager {
  private editor: any

  constructor(editor: any) {
    this.editor = editor
  }

  // Ensure the current selection is inside a real Tiptap bullet list.
  createBulletList(): boolean {
    if (!this.editor) return false

    if (this.isInBulletListAtCursor()) {
      return true
    }

    return this.editor
      .chain()
      .focus()
      .toggleBulletList()
      .run()
  }

  // Ensure the current selection is inside a real Tiptap ordered list.
  createNumberedList(): boolean {
    if (!this.editor) return false

    if (this.isInNumberedListAtCursor()) {
      return true
    }

    return this.editor
      .chain()
      .focus()
      .toggleOrderedList()
      .run()
  }

  // Convert shortcuts such as "i. " or "iv. " into a Roman ordered list.
  handleRomanListShortcut(): boolean {
    if (!this.editor) return false

    const { $from } = this.editor.state.selection

    if (!$from.parent.isTextblock) return false

    const shortcut = $from.parent.textBetween(
      0,
      $from.parentOffset
    )
    const match = shortcut.match(/^([ivxlcdm]+)\.$/)

    if (!match) return false

    const start = romanNumeralToNumber(match[1])

    if (start === null) return false

    return this.editor
      .chain()
      .focus()
      .deleteRange({
        from: $from.start(),
        to: $from.pos
      })
      .toggleOrderedList()
      .updateAttributes('orderedList', {
        start,
        type: 'i'
      })
      .run()
  }

  // Check whether the selection or cursor is inside a bullet-list node.
  isInBulletListAtCursor(): boolean {
    if (!this.editor) return false

    return this.editor.isActive('bulletList')
  }

  // Check whether the selection or cursor is inside an ordered-list node.
  isInNumberedListAtCursor(): boolean {
    if (!this.editor) return false

    return this.editor.isActive('orderedList')
  }

  // Convert the active bullet-list item back into a normal paragraph.
  exitBulletListAtCursor(): boolean {
    if (!this.editor || !this.isInBulletListAtCursor()) {
      return false
    }

    return this.editor
      .chain()
      .focus()
      .toggleBulletList()
      .run()
  }

  // Convert the active ordered-list item back into a normal paragraph.
  exitNumberedListAtCursor(): boolean {
    if (!this.editor || !this.isInNumberedListAtCursor()) {
      return false
    }

    return this.editor
      .chain()
      .focus()
      .toggleOrderedList()
      .run()
  }

  /*
   * Enter is handled natively by Tiptap.
   *
   * Its built-in list behavior creates the next item and exits the list when
   * Enter is pressed on an empty item. Returning false prevents the custom
   * key handler from overriding that behavior.
   */
  shouldHandleEnter(): boolean {
    return false
  }

  // Retained for compatibility with the existing TiptapEditor key handler.
  handleEnterInList(): boolean {
    return false
  }

  // Nest the current list item one level deeper.
  handleTab(): boolean {
    if (!this.editor || !this.editor.isActive('listItem')) {
      return false
    }

    return this.editor
      .chain()
      .focus()
      .sinkListItem('listItem')
      .run()
  }

  // Move the current list item one level outward.
  handleShiftTab(): boolean {
    if (!this.editor || !this.editor.isActive('listItem')) {
      return false
    }

    return this.editor
      .chain()
      .focus()
      .liftListItem('listItem')
      .run()
  }
}

function romanNumeralToNumber(value: string): number | null {
  const values: Record<string, number> = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000
  }
  let total = 0
  let previous = 0

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const current = values[value[index]]
    total += current < previous ? -current : current
    previous = current
  }

  if (
    total < 1 ||
    total > 3999 ||
    numberToRomanNumeral(total) !== value
  ) {
    return null
  }

  return total
}

function numberToRomanNumeral(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i']
  ]
  let remaining = value
  let result = ''

  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      result += numeral
      remaining -= amount
    }
  }

  return result
}

export default ListManager
