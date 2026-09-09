import ExcelJS from 'exceljs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { catalogKey } from '../shared/catalog';
import { calculate, itemSchema, newItem, errorMessage } from '../shared/domain';
import type { DocumentImportPreview } from '../shared/document-import';
import { value, decimal } from './product-import';
const aliases = [
  [
    'اسم البند',
    'اسم المنتج',
    'البند',
    'المنتج',
    'name',
    'item',
    'product',
    'product name',
  ],
  ['الوصف', 'description'],
  ['الكمية', 'quantity', 'qty'],
  ['سعر الوحدة', 'السعر', 'unit price', 'unitprice', 'price'],
  ['الضريبة %', 'الضريبة', 'tax', 'tax %', 'taxpercent'],
  ['الخصم', 'خصم مبلغ', 'discount'],
  ['العملة', 'currency'],
];
export async function readDocumentExcel(
  path: string,
  currency: string,
): Promise<DocumentImportPreview> {
  if ((await stat(path)).size > 10 * 1024 * 1024)
    throw new Error('الحد الأقصى للملف 10 ميغابايت');
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.readFile(path);
  } catch {
    throw new Error('اختر ملف Excel صالحاً بصيغة XLSX غير محمي بكلمة مرور');
  }
  const sheet =
    book.getWorksheet('البنود') ??
    book.getWorksheet('المنتجات') ??
    book.worksheets[0];
  if (!sheet) throw new Error('الملف لا يحتوي على جدول');
  if (sheet.rowCount > 5001 || sheet.columnCount > 100)
    throw new Error('الجدول كبير جداً؛ الحد الأقصى للمستند 200 بند');
  const columns = aliases.map((names) => {
    const matches: number[] = [];
    sheet.getRow(1).eachCell((cell, i) => {
      if (names.includes(catalogKey(value(cell)))) matches.push(i);
    });
    if (matches.length > 1) throw new Error('عمود مكرر: ' + names[0]);
    return matches[0] ?? 0;
  });
  for (const index of [0, 3])
    if (!columns[index])
      throw new Error(
        'العمود المطلوب غير موجود في الصف الأول: ' + aliases[index][0],
      );
  const rows: DocumentImportPreview['rows'] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    if (!row.hasValues) continue;
    let name = '';
    try {
      const cells = columns.map((col) => (col ? value(row.getCell(col)) : ''));
      if (cells.every((v) => !v)) continue;
      name = cells[0];
      if (cells[6] && cells[6].toUpperCase() !== currency)
        throw new Error('عملة الصف تختلف عن عملة المستند (' + currency + ')');
      let tax = decimal(cells[4]);
      if (/[%٪]$/.test(tax)) tax = tax.slice(0, -1).trim();
      else if (
        columns[4] &&
        typeof row.getCell(columns[4]).value === 'number' &&
        (row.getCell(columns[4]).numFmt ?? '').includes('%')
      )
        tax = String(Number((Number(tax) * 100).toFixed(10)));
      const item = itemSchema.parse({
        ...newItem(),
        name,
        description: cells[1],
        quantity: decimal(cells[2]) || '1',
        unitPrice: decimal(cells[3]),
        taxPercent: tax || null,
        discount: decimal(cells[5]) || null,
      });
      calculate([item]);
      rows.push({ row: n, name, item, error: null });
    } catch (error) {
      rows.push({ row: n, name, error: errorMessage(error) });
    }
    if (rows.length > 200) throw new Error('الحد الأقصى للمستند 200 بند');
  }
  if (!rows.length)
    throw new Error('الجدول فارغ؛ املأ البنود ابتداءً من الصف الثاني');
  return { filename: basename(path), rows };
}
