// Dependency-free size reduction for the bundle (build output only; the sources in site/ are never touched).
//
// stripJs() removes block comments, line comments, indentation, trailing blanks and empty lines. It never
// renames anything and never touches the inside of a string, a template literal or a regular expression, so
// the program is the same token for token; only whitespace and comments differ. A line break is kept wherever
// there was one (automatic semicolon insertion depends on them), and a block comment that contained a line
// break leaves one behind.
//
// The only judgement call is "is this slash a division or the start of a regular expression?". It is decided
// from the token before it, the way every small JavaScript tokenizer does it; tests/strip.test.cjs pins the
// known tricky cases, and the full unit and browser suites run against the stripped bundle.

const WORD = /[A-Za-z0-9_$\u0080-￿]/;
// After these words a slash starts a regular expression, not a division.
const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

export function stripJs(code) {
  const src = String(code);
  const n = src.length;
  const parts = [];
  let i = 0;
  let depth = 0;          // { } depth in code
  const templates = [];   // depths at which a ${ ... } of a template literal returns to the template
  let last = '';          // last significant character written (comments and blanks do not count)
  let prev = '';          // the one before it
  let lastWord = '';      // the identifier/keyword that ends at `last`, if any
  let pendingNl = false;  // a line break was seen; written (once) before the next token
  let pendingSp = false;  // blanks were seen; written (as one space) before the next token
  let started = false;

  // Writes a token (or a copied literal) after whatever whitespace is due.
  const emit = (s, lastChar, word) => {
    if (pendingNl) { if (started) parts.push('\n'); } else if (pendingSp && started) parts.push(' ');
    pendingNl = pendingSp = false;
    parts.push(s);
    started = true;
    prev = last; last = lastChar; lastWord = word || '';
  };
  const newline = () => { pendingNl = true; pendingSp = false; };
  const blank = () => { if (!pendingNl) pendingSp = true; };

  // Reads a quoted string starting at src[i] (the quote); returns the index after it.
  function readString(q) {
    let j = i + 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === q) { j++; break; }
      if (c === '\n') break; // unterminated: leave it to the parser
      j++;
    }
    return j;
  }

  // Reads template text from `from` (just after a backtick or a closing brace) up to and including the closing
  // backtick or the opening ${. Returns [indexAfter, endedWithInterpolation].
  function readTemplate(from) {
    let j = from;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return [j + 1, false];
      if (c === '$' && src[j + 1] === '{') return [j + 2, true];
      j++;
    }
    return [j, false];
  }

  function regexAllowed() {
    if (last === '') return true;
    if (last === ')' || last === ']') return false;
    if (last === '}') return true;
    if (WORD.test(last)) return REGEX_AFTER.has(lastWord);
    if ((last === '+' || last === '-') && prev === last) return false; // a++ / b
    if (last === '`' || last === '"' || last === "'") return false;
    return true;
  }

  // Reads a regular expression literal starting at the slash at src[i]; returns the index after its flags, or -1.
  function readRegex() {
    let j = i + 1, inClass = false, closed = false;
    while (j < n) {
      const c = src[j];
      if (c === '\n') return -1;
      if (c === '\\') { j += 2; continue; }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { j++; closed = true; break; }
      j++;
    }
    if (!closed) return -1;
    while (j < n && WORD.test(src[j])) j++;
    return j;
  }

  // A template literal piece: the text from i up to the end of the template or the next ${.
  function template(from) {
    const [j, interp] = readTemplate(from);
    emit(src.slice(i, j), '`', '');
    i = j;
    if (interp) { templates.push(depth); depth++; last = '{'; }
  }

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '\n') { newline(); i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { blank(); i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      if (src.slice(i, stop).includes('\n')) newline(); else blank();
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") { const j = readString(c); emit(src.slice(i, j), c); i = j; continue; }
    if (c === '`') { template(i + 1); continue; }
    if (c === '{') { depth++; emit(c, c); i++; continue; }
    if (c === '}') {
      depth--;
      if (templates.length && templates[templates.length - 1] === depth) { templates.pop(); template(i + 1); continue; }
      emit(c, c); i++;
      continue;
    }
    if (c === '/') {
      if (regexAllowed()) {
        const j = readRegex();
        if (j > 0) { emit(src.slice(i, j), ')'); i = j; continue; }
      }
      emit(c, c); i++;
      continue;
    }
    if (WORD.test(c)) {
      let j = i;
      while (j < n && WORD.test(src[j])) j++;
      const word = src.slice(i, j);
      emit(word, word[word.length - 1], word);
      i = j;
      continue;
    }
    emit(c, c); i++;
  }
  return parts.join('') + '\n';
}
