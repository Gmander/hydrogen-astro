// Local-only conditional-store adapter. Never bundled into the Netlify function.
import { DatabaseSync } from 'node:sqlite';
export function openLocalStore(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS objects (key TEXT PRIMARY KEY, value TEXT NOT NULL, version INTEGER NOT NULL)');
  return {
    db,
    async get(key) {
      const row = db.prepare('SELECT value, version FROM objects WHERE key=?').get(key);
      return row ? { data: JSON.parse(row.value), etag: String(row.version) } : null;
    },
    async put(key, data, etag) {
      const result = etag === null
        ? db.prepare('INSERT OR IGNORE INTO objects(key,value,version) VALUES (?,?,1)').run(key, JSON.stringify(data))
        : db.prepare('UPDATE objects SET value=?,version=version+1 WHERE key=? AND version=?').run(JSON.stringify(data), key, Number(etag));
      return result.changes === 1;
    },
    close() { db.close(); },
  };
}
