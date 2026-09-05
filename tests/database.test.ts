import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/main/database';
import {
  defaultSettings,
  newDocument,
  type Template,
} from '../src/shared/domain';
const input = () => ({
  ...newDocument(defaultSettings),
  clientName: 'عميل تجريبي',
  items: [
    {
      id: crypto.randomUUID(),
      name: 'خدمة',
      description: '',
      quantity: '2',
      unitPrice: '25.10',
      taxPercent: '20',
      discount: '0.20',
    },
  ],
});
test('migrations are repeatable, documents persist, numbering survives reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-unit-'));
  let store: Store | undefined;
  try {
    store = new Store(join(directory, 'app.db'));
    const first = store.saveDocument(input());
    assert.equal(first.number, 'INV-00001');
    assert.equal(first.totals.total, 6000);
    store.close();
    store = new Store(join(directory, 'app.db'));
    assert.equal(store.getDocument(first.id).clientName, 'عميل تجريبي');
    assert.equal(store.bootstrap().types.length, 4);
    assert.equal(store.saveDocument(input()).number, 'INV-00002');
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('failed save does not consume a number and revisions reject stale writes', () => {
  const store = new Store(':memory:');
  try {
    assert.throws(() =>
      store.saveDocument({ ...input(), templateId: crypto.randomUUID() }),
    );
    const first = store.saveDocument(input());
    assert.equal(first.number, 'INV-00001');
    const second = store.saveDocument({ ...first, clientName: 'تعديل' });
    assert.equal(second.revision, 2);
    assert.equal(second.number, first.number);
    assert.throws(() => store.saveDocument(first), /تغير المستند/);
    assert.throws(() => store.saveDocument({ ...second, typeId: 'quote' }));
  } finally {
    store.close();
  }
});
test('final documents freeze company, template, currency and edits', () => {
  const store = new Store(':memory:');
  try {
    const template: Template = {
      id: crypto.randomUUID(),
      name: 'قالب',
      background: null,
      stamp: null,
      stampX: 10,
      stampY: 75,
      stampWidth: 18,
      marginTop: 30,
      marginBottom: 25,
    };
    store.saveTemplate(template);
    store.saveSettings({ ...defaultSettings, companyName: 'الشركة الأصلية' });
    const saved = store.saveDocument({
      ...input(),
      status: 'final',
      templateId: template.id,
    });
    store.saveSettings({
      ...defaultSettings,
      companyName: 'اسم جديد',
      currency: 'USD',
    });
    store.saveTemplate({ ...template, name: 'معدل' });
    const reopened = store.getDocument(saved.id);
    assert.equal(reopened.company.companyName, 'الشركة الأصلية');
    assert.equal(reopened.template?.name, 'قالب');
    assert.equal(reopened.currency, 'TRY');
    assert.throws(
      () => store.saveDocument({ ...saved, status: 'draft' }),
      /المعتمد/,
    );
  } finally {
    store.close();
  }
});
test('backup produces a standalone database including templates and types', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-backup-test-'));
  const store = new Store(join(directory, 'app.db'));
  let restored: Store | undefined;
  try {
    store.addType({ id: 'custom-order', name: 'أمر شراء', prefix: 'PO' });
    const saved = store.saveDocument({ ...input(), typeId: 'custom-order' });
    store.backup(join(directory, 'backup.db'));
    restored = new Store(join(directory, 'backup.db'));
    assert.equal(restored.getDocument(saved.id).number, 'PO-00001');
    assert.equal(restored.bootstrap().types.length, 5);
  } finally {
    restored?.close();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('future schema versions are rejected without mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-version-'));
  try {
    const path = join(directory, 'future.db');
    const db = new DatabaseSync(path);
    db.exec('PRAGMA user_version=999');
    db.close();
    assert.throws(() => new Store(path), /أحدث/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
