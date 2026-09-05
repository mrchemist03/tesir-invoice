import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate,
  documentSchema,
  newDocument,
  defaultSettings,
  type Item,
} from '../src/shared/domain';
const item = (patch: Partial<Item> = {}): Item => ({
  id: crypto.randomUUID(),
  name: 'خدمة',
  description: '',
  quantity: '1',
  unitPrice: '0.10',
  taxPercent: null,
  discount: null,
  ...patch,
});
test('decimal calculations do not accumulate binary floating point errors', () => {
  assert.equal(calculate([item({ quantity: '3' })]).total, 30);
  assert.equal(
    calculate(Array.from({ length: 200 }, () => item())).total,
    2000,
  );
});
test('rounds fractional quantity half-up and taxes after line discount', () => {
  const totals = calculate([
    item({
      quantity: '1.005',
      unitPrice: '1.00',
      discount: '0.01',
      taxPercent: '18',
    }),
  ]);
  assert.deepEqual(totals.lines[0], {
    subtotal: 101,
    discount: 1,
    tax: 18,
    total: 118,
  });
});
test('zero optional values are preserved separately from absent values', () => {
  assert.equal(calculate([item({ taxPercent: '0', discount: '0' })]).total, 10);
  assert.equal(item().taxPercent, null);
});
test('rejects negative amounts, excessive precision and discounts above subtotal', () => {
  for (const patch of [
    { unitPrice: '-1' },
    { unitPrice: '0.001' },
    { quantity: '0' },
    { taxPercent: '101' },
    { discount: '0.11' },
  ])
    assert.throws(() => calculate([item(patch)]));
});
test('rejects totals outside safe integer range', () =>
  assert.throws(() =>
    calculate(
      Array.from({ length: 200 }, () =>
        item({ quantity: '1000000', unitPrice: '999999999.99' }),
      ),
    ),
  ));
test('validates real calendar dates', () => {
  const doc = {
    ...newDocument(defaultSettings),
    clientName: 'عميل',
    items: [item()],
  };
  assert.throws(() => documentSchema.parse({ ...doc, date: '2026-02-30' }));
  assert.equal(
    documentSchema.parse({ ...doc, date: '2024-02-29' }).date,
    '2024-02-29',
  );
});
