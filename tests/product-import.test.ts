import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readProductsExcel } from '../src/main/product-import';
import { blankProduct } from '../src/shared/catalog';
import { productHeaders } from '../src/shared/product-import';
import { Store } from '../src/main/database';
test('Excel import preserves SKU, normalizes decimals, previews duplicates and rejects formulas', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tesir-import-'));
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('المنتجات');
    sheet.addRow(productHeaders);
    sheet.addRow(['دفتر', '00125', 'وصف', '٢٥٫٥٠', 'TRY', 20]);
    sheet.addRow(['دفتر', '', '', 10, 'TRY', null]);
    sheet.addRow(['قلم', '', '', 5, 'USD', 0.2]);
    sheet.getCell('F4').numFmt = '0%';
    sheet.addRow(['خطأ', '', '', { formula: '1+1', result: 2 }, 'TRY', null]);
    sheet.addRow(['سالب', '', '', -1, 'TRY', null]);
    const path = join(dir, 'import.xlsx');
    await workbook.xlsx.writeFile(path);
    const preview = await readProductsExcel(path, 'TRY', []);
    assert.deepEqual(
      preview.rows.map((r) => r.status),
      ['new', 'duplicate', 'new', 'error', 'error'],
    );
    assert.equal(preview.rows[0].product?.sku, '00125');
    assert.equal(preview.rows[0].product?.unitPrice, '25.50');
    assert.equal(preview.rows[2].product?.taxPercent, '20');
    assert.equal(preview.rows[3].row, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('downloadable template contains no example products and can be filled then imported', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tesir-template-'));
  try {
    const source = resolve('assets/products-template.xlsx');
    await assert.rejects(readProductsExcel(source, 'TRY', []), /فارغ/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(source);
    const sheet = workbook.getWorksheet('المنتجات')!;
    sheet.getRow(2).values = ['منتج تجريبي', '0001', '', 12.25, '', null];
    const path = join(dir, 'filled.xlsx');
    await workbook.xlsx.writeFile(path);
    const preview = await readProductsExcel(path, 'SAR', []);
    assert.equal(preview.rows.length, 1);
    assert.equal(preview.rows[0].product?.currency, 'SAR');
    assert.equal(preview.rows[0].product?.sku, '0001');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('batch import is atomic, idempotent and never changes existing or archived product prices', () => {
  const store = new Store(':memory:');
  try {
    const existing = store.saveProduct({
      ...blankProduct('TRY'),
      name: 'دفتر',
      unitPrice: '100',
      archived: true,
    });
    const input = { ...blankProduct('TRY'), name: 'قلم', unitPrice: '10' };
    assert.throws(() =>
      store.importProducts([
        input,
        { ...input, name: '', unitPrice: 'invalid' },
      ]),
    );
    assert.equal(store.bootstrap().products.length, 1);
    assert.deepEqual(
      store.importProducts([input, { ...existing, unitPrice: '5' }, input]),
      { added: 1, skipped: 2 },
    );
    assert.deepEqual(store.importProducts([input]), { added: 0, skipped: 1 });
    assert.deepEqual(
      store.bootstrap().products.find((p) => p.id === existing.id),
      existing,
    );
  } finally {
    store.close();
  }
});
