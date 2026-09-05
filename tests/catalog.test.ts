import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/main/database';
import { blankCustomer, blankProduct } from '../src/shared/catalog';
import {
  defaultSettings,
  defaultTypes,
  newDocument,
  calculate,
  documentSchema,
  type SavedDocument,
} from '../src/shared/domain';
const document = () => ({
  ...newDocument(defaultSettings),
  clientName: 'عميل جديد',
  items: [
    {
      id: crypto.randomUUID(),
      name: 'منتج جديد',
      description: 'الوصف الأصلي',
      quantity: '2',
      unitPrice: '100',
      taxPercent: '10',
      discount: null,
    },
  ],
});
test('saving a document registers customer and products once and returns links', () => {
  const store = new Store(':memory:');
  try {
    const saved = store.saveDocument(document());
    const data = store.bootstrap();
    assert.equal(data.customers.length, 1);
    assert.equal(data.products.length, 1);
    assert.equal(saved.customerId, data.customers[0].id);
    assert.equal(saved.items[0].productId, data.products[0].id);
    store.saveDocument({
      ...document(),
      clientName: '  عميل   جديد ',
      items: [
        { ...document().items[0], name: ' منتج   جديد ', unitPrice: '250' },
      ],
    });
    store.saveDocument({
      ...saved,
      items: saved.items.map((item) => ({ ...item, unitPrice: '150' })),
    });
    assert.equal(store.bootstrap().customers.length, 1);
    assert.equal(store.bootstrap().products.length, 1);
    assert.equal(store.bootstrap().products[0].unitPrice, '100');
  } finally {
    store.close();
  }
});
test('failed document rolls back new catalog entries and numbering', () => {
  const store = new Store(':memory:');
  try {
    const input = document();
    assert.throws(() =>
      store.saveDocument({
        ...input,
        items: [
          ...input.items,
          {
            ...input.items[0],
            id: crypto.randomUUID(),
            productId: crypto.randomUUID(),
            name: 'غير موجود',
          },
        ],
      }),
    );
    const data = store.bootstrap();
    assert.equal(data.customers.length, 0);
    assert.equal(data.products.length, 0);
    assert.equal(data.documents.length, 0);
    assert.equal(store.saveDocument(document()).number, 'INV-00001');
  } finally {
    store.close();
  }
});
test('catalog edits preserve old documents, reject duplicates and stale writes', () => {
  const store = new Store(':memory:');
  try {
    const customer = store.saveCustomer({
      ...blankCustomer(),
      name: 'شركة A',
      phone: '123',
    });
    const product = store.saveProduct({
      ...blankProduct('TRY'),
      name: 'Product A',
      unitPrice: '90',
    });
    const saved = store.saveDocument({
      ...document(),
      customerId: customer.id,
      clientName: customer.name,
      items: [
        {
          ...document().items[0],
          productId: product.id,
          name: product.name,
          unitPrice: '90',
        },
      ],
      status: 'final',
    });
    store.saveCustomer({ ...customer, name: 'شركة B' });
    store.saveProduct({
      ...product,
      name: 'Product B',
      unitPrice: '150',
      archived: true,
    });
    assert.equal(store.getDocument(saved.id).clientName, 'شركة A');
    assert.equal(store.getDocument(saved.id).items[0].unitPrice, '90');
    assert.equal(store.getDocument(saved.id).items[0].name, 'Product A');
    assert.throws(() => store.saveCustomer(customer), /تغير العميل/);
    assert.throws(() => store.saveProduct(product), /تغير المنتج/);
    assert.throws(
      () => store.saveProduct({ ...blankProduct('TRY'), name: ' product b ' }),
      /يوجد منتج/,
    );
    assert.throws(
      () => store.saveCustomer({ ...blankCustomer(), name: 'شركة B' }),
      /يوجد عميل/,
    );
  } finally {
    store.close();
  }
});
test('same product name can have separate currencies without mixing invoice prices', () => {
  const store = new Store(':memory:');
  try {
    store.saveDocument(document());
    store.saveSettings({ ...defaultSettings, currency: 'USD' });
    store.saveDocument({ ...document(), currency: 'USD' });
    assert.equal(store.bootstrap().products.length, 2);
    const usd = store.bootstrap().products.find((p) => p.currency === 'USD')!;
    store.saveSettings(defaultSettings);
    assert.throws(
      () =>
        store.saveDocument({
          ...document(),
          items: [{ ...document().items[0], productId: usd.id }],
        }),
      /عملته مختلفة/,
    );
    assert.throws(() => store.saveProduct({ ...usd, currency: 'TRY' }), /عملة/);
  } finally {
    store.close();
  }
});
test('v1 migration backs up old data and backfills catalogs without changing snapshots', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-v1-catalog-'));
  let store: Store | undefined;
  try {
    const path = join(directory, 'app.db');
    const db = new DatabaseSync(path);
    db.exec(
      readFileSync(new URL('./fixtures/v1.sql', import.meta.url), 'utf8'),
    );
    db.prepare('INSERT INTO settings VALUES(1,?)').run(
      JSON.stringify(defaultSettings),
    );
    for (const type of defaultTypes)
      db.prepare(
        'INSERT INTO document_types(id,name,prefix) VALUES(?,?,?)',
      ).run(type.id, type.name, type.prefix);
    const input = document();
    const saved: SavedDocument = {
      ...input,
      revision: 1,
      status: 'final',
      number: 'INV-00001',
      typeName: 'فاتورة',
      currency: 'TRY',
      company: defaultSettings,
      template: null,
      totals: calculate(input.items),
      createdAt: '2026-09-05T00:00:00Z',
      updatedAt: '2026-09-05T00:00:00Z',
    };
    const payload = JSON.stringify(saved);
    db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
      saved.id,
      saved.typeId,
      saved.number,
      saved.clientName,
      saved.date,
      saved.status,
      1,
      saved.totals.total,
      saved.currency,
      payload,
      saved.createdAt,
      saved.updatedAt,
    );
    db.prepare('UPDATE document_types SET next_number=2 WHERE id=?').run(
      'invoice',
    );
    db.close();
    store = new Store(path);
    assert.deepEqual(store.getDocument(saved.id), saved);
    assert.equal(store.bootstrap().products.length, 1);
    assert.equal(store.bootstrap().customers.length, 1);
    assert.equal(store.saveDocument(document()).number, 'INV-00002');
    store.close();
    store = undefined;
    const upgraded = new DatabaseSync(path);
    assert.equal(
      upgraded
        .prepare('SELECT payload FROM documents WHERE id=?')
        .get(saved.id)!.payload,
      payload,
    );
    assert.equal(
      upgraded.prepare('PRAGMA user_version').get()!.user_version,
      2,
    );
    upgraded.close();
    const backups = readdirSync(join(directory, 'backups'));
    assert.equal(backups.length, 1);
    const backup = new DatabaseSync(join(directory, 'backups', backups[0]));
    assert.equal(backup.prepare('PRAGMA user_version').get()!.user_version, 1);
    backup.close();
    store = new Store(path);
    assert.equal(store.bootstrap().products.length, 1);
    assert.equal(readdirSync(join(directory, 'backups')).length, 1);
  } finally {
    store?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cloning a saved document retains its currency and product links after defaults change', () => {
  const store = new Store(':memory:');
  try {
    const saved = store.saveDocument({ ...document(), status: 'final' });
    store.saveSettings({ ...defaultSettings, currency: 'USD' });
    const clone = store.saveDocument({
      ...documentSchema.parse(saved),
      id: crypto.randomUUID(),
      revision: 0,
      status: 'draft',
    });
    assert.equal(clone.currency, 'TRY');
    assert.equal(clone.items[0].productId, saved.items[0].productId);
    assert.equal(store.bootstrap().products.length, 1);
  } finally {
    store.close();
  }
});
