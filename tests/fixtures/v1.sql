PRAGMA user_version=1;
CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
CREATE TABLE document_types (id TEXT PRIMARY KEY, name TEXT NOT NULL, prefix TEXT NOT NULL UNIQUE, next_number INTEGER NOT NULL DEFAULT 1 CHECK(next_number>0));
CREATE TABLE templates (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE documents (
 id TEXT PRIMARY KEY, type_id TEXT NOT NULL REFERENCES document_types(id), number TEXT NOT NULL UNIQUE,
 client_name TEXT NOT NULL, doc_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','final')),
 revision INTEGER NOT NULL, total INTEGER NOT NULL CHECK(total>=0), currency TEXT NOT NULL,
 payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX documents_date ON documents(doc_date DESC);
CREATE INDEX documents_type_date ON documents(type_id,doc_date DESC);
