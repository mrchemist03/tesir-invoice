import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords } from '../src/shared/tafqeet';
import { Store } from '../src/main/database';
import { defaultSettings, newDocument, newItem } from '../src/shared/domain';
test('tafqeet handles zero, exact cents, gender and currency units', () => {
  assert.equal(amountInWords(0, 'TRY'), 'صفر ليرة تركية فقط لا غير');
  assert.equal(amountInWords(1, 'TRY'), 'قرش واحد فقط لا غير');
  assert.equal(amountInWords(2, 'SAR'), 'هللتان فقط لا غير');
  assert.equal(amountInWords(3, 'SAR'), 'ثلاث هللات فقط لا غير');
  assert.equal(amountInWords(21, 'USD'), 'واحد وعشرون سنت فقط لا غير');
  assert.equal(amountInWords(200, 'TRY'), 'ليرتان تركيتان فقط لا غير');
  assert.equal(
    amountInWords(101, 'AED'),
    'درهم إماراتي واحد وفلس واحد فقط لا غير',
  );
  for (const currency of ['TRY', 'USD', 'EUR', 'SAR', 'AED'] as const) {
    for (let cents = 1; cents < 100; cents++)
      assert.match(amountInWords(cents, currency), /فقط لا غير$/);
    assert.match(
      amountInWords(Number.MAX_SAFE_INTEGER, currency),
      /فقط لا غير$/,
    );
  }
  assert.throws(() => amountInWords(0.1, 'TRY'));
});
test('words snapshot uses computed discounted taxed total and preserves legacy documents', () => {
  const store = new Store(':memory:');
  try {
    const doc = {
      ...newDocument(defaultSettings),
      clientName: 'عميل',
      items: [
        {
          ...newItem(),
          name: 'منتج',
          unitPrice: '100',
          discount: '10',
          taxPercent: '20',
        },
      ],
    };
    const saved = store.saveDocument({ ...doc, amountInWords: 'مزور' });
    assert.equal(saved.totals.total, 10800);
    assert.equal(saved.amountInWords, amountInWords(10800, 'TRY'));
    const legacy = store.saveDocument({
      ...newDocument(defaultSettings),
      clientName: 'قديم',
      showAmountInWords: undefined,
      items: doc.items,
    });
    assert.equal(legacy.amountInWords, undefined);
    const off = store.saveDocument({ ...saved, showAmountInWords: false });
    assert.equal(off.amountInWords, undefined);
  } finally {
    store.close();
  }
});
