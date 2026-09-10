import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readDocumentExcel } from '../src/main/document-import';
import { mergeImportedItems } from '../src/shared/document-import';
import { calculate, newItem } from '../src/shared/domain';
test('document template imports quantity, tax, discount and repeated lines without catalog deduplication', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tesir-items-'));
  try {
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(resolve('assets/document-items-template.xlsx'));
    const sheet = book.getWorksheet('البنود')!;
    sheet.getRow(2).values = ['خدمة', 'وصف', 2.5, 100, 20, 10];
    sheet.getRow(3).values = ['خدمة', '', 1, 50, null, null];
    const path = join(dir, 'items.xlsx');
    await book.xlsx.writeFile(path);
    const p = await readDocumentExcel(path, 'TRY');
    assert.equal(p.rows.length, 2);
    assert.equal(p.rows[0].error, null);
    assert.equal(p.rows[0].item?.quantity, '2.5');
    const items = mergeImportedItems(
      [newItem()],
      p.rows.map((r) => r.item!),
      false,
    );
    assert.equal(items.length, 2);
    assert.equal(calculate(items).total, 33800);
    assert.notEqual(items[0].id, p.rows[0].item!.id);
    assert.equal(items[0].productId, null);
    const existing = { ...newItem(), name: 'قديم', unitPrice: '1' };
    assert.equal(mergeImportedItems([existing], items, false).length, 3);
    assert.equal(mergeImportedItems([existing], items, true).length, 2);
    assert.throws(
      () =>
        mergeImportedItems(
          Array.from({ length: 200 }, () => existing),
          items,
          false,
        ),
      /200/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('document import reports currency, invalid quantity, excessive discount and formulas without mutation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tesir-items-errors-'));
  try {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet('البنود');
    s.addRow(['اسم البند', 'سعر الوحدة', 'الكمية', 'الخصم', 'العملة']);
    s.addRow(['عملة', 10, 1, null, 'USD']);
    s.addRow(['كمية', 10, 0, null, 'TRY']);
    s.addRow(['خصم', 10, 1, 11, 'TRY']);
    s.addRow(['صيغة', { formula: '1+1', result: 2 }, 1, null, 'TRY']);
    s.addRow(['صالح', 0, null, null, 'TRY']);
    const path = join(dir, 'errors.xlsx');
    await book.xlsx.writeFile(path);
    const p = await readDocumentExcel(path, 'TRY');
    assert.deepEqual(
      p.rows.map((r) => !!r.error),
      [true, true, true, true, false],
    );
    assert.equal(p.rows[4].item?.quantity, '1');
    assert.equal(p.rows[4].item?.unitPrice, '0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
