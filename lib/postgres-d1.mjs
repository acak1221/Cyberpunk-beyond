// The small D1 subset used by the existing state and campaign services.
// Accepts an injected node-postgres Pool; no credentials are read here.
// All application writers must use this adapter: the transaction-scoped lock
// preserves SQLite/D1's single-writer behavior for limits and invitation races.
const LOCK_SQL = 'SELECT pg_advisory_xact_lock(1313034819, 1380271188)';
const OWNER = Symbol('postgres-d1-owner');

// Only the query syntax used by these services is supported. The scanner keeps
// question marks inside strings, identifiers, comments, and dollar quotes intact.
export function translateSql(input) {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('SQL must be nonempty');
  let sql = input;
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  if (ignore) sql = sql.replace(/^(\s*)INSERT\s+OR\s+IGNORE\s+INTO\b/i, '$1INSERT INTO');
  let output = '', index = 0, mode = 'normal', tag = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (mode === 'single' || mode === 'double') {
      output += c;
      const quote = mode === 'single' ? "'" : '"';
      if (c === quote) { if (next === quote) output += sql[++i]; else mode = 'normal'; }
      continue;
    }
    if (mode === 'line') { output += c; if (c === '\n') mode = 'normal'; continue; }
    if (mode === 'block') { output += c; if (c === '*' && next === '/') { output += sql[++i]; mode = 'normal'; } continue; }
    if (mode === 'dollar') {
      if (sql.startsWith(tag, i)) { output += tag; i += tag.length - 1; mode = 'normal'; }
      else output += c;
      continue;
    }
    if (c === "'") { mode = 'single'; output += c; continue; }
    if (c === '"') { mode = 'double'; output += c; continue; }
    if (c === '-' && next === '-') { mode = 'line'; output += c + next; i++; continue; }
    if (c === '/' && next === '*') { mode = 'block'; output += c + next; i++; continue; }
    if (c === '$') { const found = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/); if (found) { tag = found[0]; mode = 'dollar'; output += tag; i += tag.length - 1; continue; } }
    if (c === '?') { output += '$' + ++index; continue; }
    output += c;
  }
  if (!['normal', 'line'].includes(mode)) throw new TypeError('Unterminated SQL literal or comment');
  if (ignore) {
    // The only INSERT OR IGNORE in the service is a single INSERT ... SELECT.
    // Do not silently rewrite an already conflicting clause or multiple statements.
    if (/\bON\s+CONFLICT\b/i.test(output) || /;\s*\S/.test(output)) throw new TypeError('Unsupported INSERT OR IGNORE');
    output = output.replace(/;\s*$/, '').trimEnd() + ' ON CONFLICT DO NOTHING';
  }
  return { sql: output, parameters: index };
}

function normalized(result) {
  return { success: true, results: Array.isArray(result?.rows) ? result.rows : [], meta: { changes: Number(result?.rowCount ?? 0) } };
}

export function createPostgresD1(pool) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') throw new TypeError('A PostgreSQL pool is required');
  const owner = {};
  async function transaction(fn) {
    const client = await pool.connect();
    let begun = false, discard = false;
    try {
      await client.query('BEGIN'); begun = true;
      await client.query(LOCK_SQL);
      const value = await fn(client);
      await client.query('COMMIT'); begun = false;
      return value;
    } catch (error) {
      if (begun) { try { await client.query('ROLLBACK'); } catch { discard = true; } }
      else discard = true;
      throw error;
    } finally { client.release(discard ? new Error('Unusable PostgreSQL connection') : undefined); }
  }
  class Statement {
    constructor(input, values = null) { const compiled = translateSql(input); this.sql = compiled.sql; this.count = compiled.parameters; this.values = values; this[OWNER] = owner; }
    bind(...values) { if (values.length !== this.count || values.some(v => v === undefined)) throw new TypeError('Incorrect SQL bindings'); const statement = Object.create(Statement.prototype); Object.assign(statement, {sql:this.sql, count:this.count, values:[...values], [OWNER]:owner}); return statement; }
    async execute(client) { if (!this.values && this.count) throw new TypeError('SQL parameters are not bound'); return normalized(await client.query(this.sql, this.values || [])); }
    async first(column) { const result = /^\s*SELECT\b/i.test(this.sql) ? await this.execute(pool) : await transaction(client => this.execute(client)); const row = result.results[0] ?? null; return column === undefined || row === null ? row : row[column] ?? null; }
    async all() { return /^\s*SELECT\b/i.test(this.sql) ? this.execute(pool) : transaction(client => this.execute(client)); }
    async run() { return transaction(client => this.execute(client)); }
  }
  return {
    prepare(sql) { return new Statement(sql); },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.some(s => !(s instanceof Statement) || s[OWNER] !== owner)) throw new TypeError('Invalid batch');
      if (!statements.length) return [];
      return transaction(async client => { const output = []; for (const statement of statements) output.push(await statement.execute(client)); return output; });
    },
  };
}

export { LOCK_SQL };
