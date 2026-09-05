import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  calculate,
  defaultSettings,
  defaultTypes,
  documentSchema,
  settingsSchema,
  templateSchema,
  typeSchema,
  type Bootstrap,
  type DocumentSummary,
  type SavedDocument,
  type Settings,
  type Template,
  type DocumentType,
} from '../shared/domain';

const migrations = [
  {
    version: 1,
    sql: `
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
`,
  },
];
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
    );
    try {
      const current = Number(
        (
          this.db.prepare('PRAGMA user_version').get() as {
            user_version: number;
          }
        ).user_version,
      );
      if (current > migrations.at(-1)!.version)
        throw new Error(
          'قاعدة البيانات أحدث من هذا التطبيق؛ استخدم إصداراً أحدث',
        );
      for (const migration of migrations.filter((m) => m.version > current))
        this.transaction(() => {
          this.db.exec(migration.sql);
          this.db.exec(`PRAGMA user_version=${migration.version}`);
        });
      this.transaction(() => {
        this.db
          .prepare('INSERT OR IGNORE INTO settings VALUES (1,?)')
          .run(JSON.stringify(defaultSettings));
        const insert = this.db.prepare(
          'INSERT OR IGNORE INTO document_types(id,name,prefix) VALUES (?,?,?)',
        );
        for (const type of defaultTypes)
          insert.run(type.id, type.name, type.prefix);
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  getSettings(): Settings {
    return settingsSchema.parse(
      JSON.parse(
        this.db.prepare('SELECT payload FROM settings WHERE id=1').get()!
          .payload as string,
      ),
    );
  }
  bootstrap(): Bootstrap {
    const templates = this.db
      .prepare('SELECT payload FROM templates')
      .all()
      .map((row) => templateSchema.parse(JSON.parse(row.payload as string)));
    const types = this.db
      .prepare('SELECT id,name,prefix FROM document_types ORDER BY rowid')
      .all() as unknown as DocumentType[];
    const documents = this.db
      .prepare(
        `SELECT d.id,d.number,d.client_name AS clientName,d.doc_date AS date,t.name AS typeName,d.type_id AS typeId,d.status,d.total,d.currency FROM documents d JOIN document_types t ON t.id=d.type_id ORDER BY d.doc_date DESC,d.created_at DESC`,
      )
      .all() as unknown as DocumentSummary[];
    return { settings: this.getSettings(), types, templates, documents };
  }
  getDocument(id: unknown): SavedDocument {
    const row = this.db
      .prepare('SELECT payload FROM documents WHERE id=?')
      .get(z.string().uuid().parse(id));
    if (!row) throw new Error('المستند غير موجود');
    return JSON.parse(row.payload as string) as SavedDocument;
  }
  saveDocument(raw: unknown): SavedDocument {
    const input = documentSchema.parse(raw);
    const totals = calculate(input.items);
    return this.transaction(() => {
      const existingRow = this.db
        .prepare('SELECT payload FROM documents WHERE id=?')
        .get(input.id);
      const existing = existingRow
        ? (JSON.parse(existingRow.payload as string) as SavedDocument)
        : null;
      if (existing?.status === 'final')
        throw new Error('المستند المعتمد لا يقبل التعديل؛ أنشئ نسخة جديدة');
      if ((existing?.revision ?? 0) !== input.revision)
        throw new Error('تغير المستند؛ أعد فتحه قبل الحفظ');
      if (existing && existing.typeId !== input.typeId)
        throw new Error('لا يمكن تغيير نوع مستند مرقّم');
      const type = this.db
        .prepare('SELECT * FROM document_types WHERE id=?')
        .get(input.typeId);
      if (!type) throw new Error('نوع المستند غير موجود');
      let template: Template | null = null;
      if (input.templateId) {
        const row = this.db
          .prepare('SELECT payload FROM templates WHERE id=?')
          .get(input.templateId);
        if (!row) throw new Error('القالب غير موجود');
        template = templateSchema.parse(JSON.parse(row.payload as string));
      }
      const company = this.getSettings();
      const now = new Date().toISOString();
      const saved: SavedDocument = {
        ...input,
        revision: input.revision + 1,
        number:
          existing?.number ??
          `${type.prefix}-${String(type.next_number).padStart(5, '0')}`,
        typeName: type.name as string,
        currency: existing?.currency ?? company.currency,
        company,
        template,
        totals,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (!existing)
        this.db
          .prepare(
            'UPDATE document_types SET next_number=next_number+1 WHERE id=?',
          )
          .run(input.typeId);
      this.db
        .prepare(
          `INSERT INTO documents(id,type_id,number,client_name,doc_date,status,revision,total,currency,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET client_name=excluded.client_name,doc_date=excluded.doc_date,status=excluded.status,revision=excluded.revision,total=excluded.total,payload=excluded.payload,updated_at=excluded.updated_at`,
        )
        .run(
          saved.id,
          saved.typeId,
          saved.number,
          saved.clientName,
          saved.date,
          saved.status,
          saved.revision,
          totals.total,
          saved.currency,
          JSON.stringify(saved),
          saved.createdAt,
          now,
        );
      return saved;
    });
  }
  saveSettings(raw: unknown): Settings {
    const settings = settingsSchema.parse(raw);
    this.db
      .prepare('UPDATE settings SET payload=? WHERE id=1')
      .run(JSON.stringify(settings));
    return settings;
  }
  saveTemplate(raw: unknown): Template {
    const template = templateSchema.parse(raw);
    this.db
      .prepare(
        'INSERT INTO templates VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
      )
      .run(template.id, JSON.stringify(template));
    return template;
  }
  addType(raw: unknown): DocumentType {
    const type = typeSchema.parse(raw);
    if (
      this.db
        .prepare(
          'SELECT 1 FROM document_types WHERE id=? OR prefix=? OR name=?',
        )
        .get(type.id, type.prefix, type.name)
    )
      throw new Error('اسم النوع أو بادئته مستخدم بالفعل');
    this.db
      .prepare('INSERT INTO document_types(id,name,prefix) VALUES(?,?,?)')
      .run(type.id, type.name, type.prefix);
    return type;
  }
  backup(path: string): void {
    this.db.prepare('VACUUM INTO ?').run(path);
  }
  close(): void {
    this.db.close();
  }
}
