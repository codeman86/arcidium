/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { Server } = require("@hocuspocus/server");
const Database = require("better-sqlite3");
const Y = require("yjs");

const host = process.env.COLLAB_HOST || "0.0.0.0";
const port = Number(process.env.COLLAB_PORT || 1234);
const dbPath = process.env.COLLAB_DB_PATH || "/app/data/collab.sqlite";

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS docs (
    name TEXT PRIMARY KEY,
    state BLOB,
    updated_at INTEGER
  )
`);

const selectDoc = db.prepare("SELECT state FROM docs WHERE name = ?");
const upsertDoc = db.prepare(`
  INSERT INTO docs (name, state, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    state = excluded.state,
    updated_at = excluded.updated_at
`);

const loadDocument = (documentName) => {
  const row = selectDoc.get(documentName);
  if (!row?.state) return new Y.Doc();

  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, new Uint8Array(row.state));
  } catch (error) {
    console.error(`Failed to load document ${documentName} from SQLite`, error);
  }
  return doc;
};

const persistDocument = (documentName, doc) => {
  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  upsertDoc.run(documentName, state, Date.now());
};

const server = new Server({
  port,
  address: host,
  debounce: 800,
  maxDebounce: 2500,
  quiet: true,
  async onLoadDocument(payload) {
    return loadDocument(payload.documentName);
  },
  async onStoreDocument(payload) {
    persistDocument(payload.documentName, payload.document);
  },
});

server.listen();
console.log(
  `[collab] listening on ws://${host}:${port} (DB: ${dbPath}, pid: ${process.pid})`,
);

const shutdown = () => {
  console.log("[collab] shutting down");
  server.destroy();
  db.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
