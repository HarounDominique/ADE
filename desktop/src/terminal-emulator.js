const DEFAULT_ROWS = 24;
const DEFAULT_COLUMNS = 120;

function blankRow(columns) {
  return Array.from({ length: columns }, () => ' ');
}

function blankScreen(rows, columns) {
  return Array.from({ length: rows }, () => blankRow(columns));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Small terminal surface for the native PTY.
 * It intentionally covers the cursor, erase, alternate-screen and text
 * operations used by shells and common TUIs without exposing escape bytes.
 */
export class TerminalEmulator {
  constructor({ rows = DEFAULT_ROWS, columns = DEFAULT_COLUMNS, onChange } = {}) {
    this.rows = rows;
    this.columns = columns;
    this.onChange = onChange;
    this.mainScreen = blankScreen(rows, columns);
    this.alternateScreen = blankScreen(rows, columns);
    this.screen = this.mainScreen;
    this.cursor = { row: 0, column: 0 };
    this.savedCursor = { row: 0, column: 0 };
    this.mainCursor = { row: 0, column: 0 };
    this.alternateCursor = { row: 0, column: 0 };
    this.alternate = false;
    this.escapeState = 'text';
    this.escapeBuffer = '';
  }

  write(chunk) {
    for (const character of String(chunk)) this.consume(character);
    this.emit();
  }

  clear() {
    this.mainScreen = blankScreen(this.rows, this.columns);
    this.alternateScreen = blankScreen(this.rows, this.columns);
    this.screen = this.alternate ? this.alternateScreen : this.mainScreen;
    this.cursor = { row: 0, column: 0 };
    this.emit();
  }

  text() {
    return this.screen.map((row) => row.join('').replace(/ +$/, '')).join('\n').replace(/\n+$/, '');
  }

  consume(character) {
    if (this.escapeState === 'text') {
      if (character === '\u001b') {
        this.escapeState = 'escape';
        return;
      }
      this.consumeText(character);
      return;
    }
    if (this.escapeState === 'escape') {
      if (character === '[') {
        this.escapeState = 'csi';
        this.escapeBuffer = '';
        return;
      }
      if (character === ']') {
        this.escapeState = 'osc';
        this.escapeBuffer = '';
        return;
      }
      this.handleEscape(character);
      this.escapeState = 'text';
      return;
    }
    if (this.escapeState === 'osc') {
      if (character === '\u0007') {
        this.escapeState = 'text';
        return;
      }
      if (character === '\u001b') {
        this.escapeState = 'osc-escape';
        return;
      }
      this.escapeBuffer += character;
      return;
    }
    if (this.escapeState === 'osc-escape') {
      this.escapeState = character === '\\' ? 'text' : 'osc';
      return;
    }
    this.escapeBuffer += character;
    if (character >= '@' && character <= '~') {
      this.handleCSI(this.escapeBuffer);
      this.escapeState = 'text';
      this.escapeBuffer = '';
    }
  }

  consumeText(character) {
    if (character === '\r') {
      this.cursor.column = 0;
      return;
    }
    if (character === '\n') {
      this.lineFeed();
      return;
    }
    if (character === '\b') {
      this.cursor.column = Math.max(0, this.cursor.column - 1);
      return;
    }
    if (character === '\t') {
      this.cursor.column = clamp(Math.floor(this.cursor.column / 8 + 1) * 8, 0, this.columns - 1);
      return;
    }
    if (character < ' ') return;
    if (this.cursor.column >= this.columns) {
      this.cursor.column = 0;
      this.lineFeed();
    }
    this.screen[this.cursor.row][this.cursor.column] = character;
    this.cursor.column += 1;
  }

  handleEscape(character) {
    if (character === '7') this.saveCursor();
    else if (character === '8') this.restoreCursor();
    else if (character === 'c') this.reset();
    else if (character === 'D') this.lineFeed();
    else if (character === 'M') this.reverseLineFeed();
  }

  handleCSI(sequence) {
    const final = sequence.at(-1);
    const body = sequence.slice(0, -1);
    const privateMode = body.startsWith('?');
    const normalized = privateMode ? body.slice(1) : body;
    const values = normalized.split(';').map((value) => (value === '' ? 0 : Number.parseInt(value, 10))).map((value) => (Number.isFinite(value) ? value : 0));
    const first = values[0] || 1;
    if (privateMode && (final === 'h' || final === 'l')) {
      this.handleMode(values, final === 'h');
      return;
    }
    switch (final) {
      case 'A': this.cursor.row = clamp(this.cursor.row - first, 0, this.rows - 1); break;
      case 'B': this.cursor.row = clamp(this.cursor.row + first, 0, this.rows - 1); break;
      case 'C': case 'a': this.cursor.column = clamp(this.cursor.column + first, 0, this.columns - 1); break;
      case 'D': case 'j': this.cursor.column = clamp(this.cursor.column - first, 0, this.columns - 1); break;
      case 'G': case '`': this.cursor.column = clamp(first - 1, 0, this.columns - 1); break;
      case 'd': this.cursor.row = clamp(first - 1, 0, this.rows - 1); break;
      case 'E': this.cursor.row = clamp(this.cursor.row + first, 0, this.rows - 1); this.cursor.column = 0; break;
      case 'F': this.cursor.row = clamp(this.cursor.row - first, 0, this.rows - 1); this.cursor.column = 0; break;
      case 'H': case 'f': this.setCursor(values[0] || 1, values[1] || 1); break;
      case 'J': this.eraseDisplay(values[0]); break;
      case 'K': this.eraseLine(values[0]); break;
      case 'P': this.deleteCharacters(first); break;
      case '@': this.insertCharacters(first); break;
      case 'X': this.eraseCharacters(first); break;
      case 'L': this.insertLines(first); break;
      case 'M': this.deleteLines(first); break;
      case 's': this.saveCursor(); break;
      case 'u': this.restoreCursor(); break;
      case 'm': break;
      case 'r': break;
      default: break;
    }
  }

  handleMode(values, enabled) {
    if (values.includes(1049) || values.includes(1047) || values.includes(47)) {
      if (enabled && !this.alternate) this.enterAlternate();
      if (!enabled && this.alternate) this.leaveAlternate();
    }
  }

  setCursor(row, column) {
    this.cursor.row = clamp(row - 1, 0, this.rows - 1);
    this.cursor.column = clamp(column - 1, 0, this.columns - 1);
  }

  lineFeed() {
    if (this.cursor.row === this.rows - 1) {
      this.screen.shift();
      this.screen.push(blankRow(this.columns));
      return;
    }
    this.cursor.row += 1;
  }

  reverseLineFeed() {
    if (this.cursor.row === 0) {
      this.screen.pop();
      this.screen.unshift(blankRow(this.columns));
      return;
    }
    this.cursor.row -= 1;
  }

  eraseDisplay(mode = 0) {
    if (mode === 2 || mode === 3) {
      this.screen = blankScreen(this.rows, this.columns);
      if (this.alternate) this.alternateScreen = this.screen;
      else this.mainScreen = this.screen;
      this.cursor = { row: 0, column: 0 };
      return;
    }
    if (mode === 1) {
      for (let row = 0; row <= this.cursor.row; row += 1) {
        const end = row === this.cursor.row ? this.cursor.column + 1 : this.columns;
        this.screen[row].fill(' ', 0, end);
      }
      return;
    }
    for (let row = this.cursor.row; row < this.rows; row += 1) {
      const start = row === this.cursor.row ? this.cursor.column : 0;
      this.screen[row].fill(' ', start);
    }
  }

  eraseLine(mode = 0) {
    if (mode === 2) this.screen[this.cursor.row].fill(' ');
    else if (mode === 1) this.screen[this.cursor.row].fill(' ', 0, this.cursor.column + 1);
    else this.screen[this.cursor.row].fill(' ', this.cursor.column);
  }

  eraseCharacters(count) {
    this.screen[this.cursor.row].fill(' ', this.cursor.column, clamp(this.cursor.column + count, 0, this.columns));
  }

  deleteCharacters(count) {
    const row = this.screen[this.cursor.row];
    row.splice(this.cursor.column, count);
    row.push(...blankRow(Math.min(count, this.columns)));
    row.length = this.columns;
  }

  insertCharacters(count) {
    const row = this.screen[this.cursor.row];
    row.splice(this.cursor.column, 0, ...blankRow(Math.min(count, this.columns)));
    row.length = this.columns;
  }

  insertLines(count) {
    this.screen.splice(this.cursor.row, 0, ...Array.from({ length: Math.min(count, this.rows) }, () => blankRow(this.columns)));
    this.screen.length = this.rows;
  }

  deleteLines(count) {
    this.screen.splice(this.cursor.row, Math.min(count, this.rows));
    this.screen.push(...Array.from({ length: Math.min(count, this.rows) }, () => blankRow(this.columns)));
    this.screen.length = this.rows;
  }

  saveCursor() {
    this.savedCursor = { ...this.cursor };
  }

  restoreCursor() {
    this.cursor = { ...this.savedCursor };
  }

  enterAlternate() {
    this.mainCursor = { ...this.cursor };
    this.alternate = true;
    this.screen = this.alternateScreen;
    this.cursor = { ...this.alternateCursor };
    this.eraseDisplay(2);
  }

  leaveAlternate() {
    this.alternateCursor = { ...this.cursor };
    this.alternate = false;
    this.screen = this.mainScreen;
    this.cursor = { ...this.mainCursor };
  }

  reset() {
    this.alternate = false;
    this.screen = this.mainScreen = blankScreen(this.rows, this.columns);
    this.alternateScreen = blankScreen(this.rows, this.columns);
    this.cursor = { row: 0, column: 0 };
    this.savedCursor = { row: 0, column: 0 };
    this.escapeState = 'text';
    this.escapeBuffer = '';
  }

  emit() {
    this.onChange?.(this.text(), this);
  }
}
