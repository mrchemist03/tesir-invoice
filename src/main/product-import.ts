import ExcelJS from 'exceljs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  blankProduct,
  catalogKey,
  productSchema,
  type Product,
} from '../shared/catalog';
import {
  productHeaders,
  type ImportPreview,
  type ImportRow,
} from '../shared/product-import';
import { errorMessage } from '../shared/domain';
const aliases = [
  ['اسم المنتج', 'المنتج', 'name', 'product', 'product name'],
  ['رمز المنتج', 'الرمز', 'sku', 'code'],
  ['الوصف', 'description'],
  ['سعر الوحدة', 'السعر', 'unit price', 'price', 'unitprice'],
  ['العملة', 'currency'],
  ['الضريبة %', 'الضريبة', 'tax', 'tax %', 'taxpercent'],
];
function value(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (typeof v === 'object' && 'richText' in v)
    return v.richText
      .map((x) => x.text)
      .join('')
      .trim();
  throw new Error(
    'استخدم لصق القيم فقط؛ الصيغ والتواريخ والخلايا غير النصية أو الرقمية غير مدعومة',
  );
}
function decimal(text: string): string {
  return text
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/٫/g, '.');
}
export async function readProductsExcel(
  path: string,
  currency: Product['currency'],
  existing: Product[],
): Promise<ImportPreview> {
  if ((await stat(path)).size > 10 * 1024 * 1024)
    throw new Error('الحد الأقصى للملف 10 ميغابايت');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(path);
  } catch {
    throw new Error(
      'تعذر قراءة الملف؛ اختر ملف Excel بصيغة XLSX غير محمي بكلمة مرور',
    );
  }
  const sheet = workbook.getWorksheet('المنتجات') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('الملف لا يحتوي على جدول');
  if (sheet.rowCount > 5001 || sheet.columnCount > 100)
    throw new Error('الحد الأقصى 5000 صف و100 عمود');
  const columns = aliases.map((names) => {
    const matches: number[] = [];
    sheet.getRow(1).eachCell((cell, index) => {
      if (names.includes(catalogKey(value(cell)))) matches.push(index);
    });
    if (matches.length > 1) throw new Error('عمود مكرر: ' + names[0]);
    return matches[0] ?? 0;
  });
  for (const index of [0, 3])
    if (!columns[index])
      throw new Error(
        'العمود المطلوب غير موجود في الصف الأول: ' + productHeaders[index],
      );
  const seen = new Set(
    existing.map((p) => JSON.stringify([catalogKey(p.name), p.currency])),
  );
  const rows: ImportRow[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    if (!row.hasValues) continue;
    let name = '';
    try {
      const cells = columns.map((col) => (col ? value(row.getCell(col)) : ''));
      if (cells.every((v) => !v)) continue;
      name = cells[0];
      let tax = decimal(cells[5]);
      if (tax.endsWith('%') || tax.endsWith('٪')) tax = tax.slice(0, -1).trim();
      else if (
        columns[5] &&
        typeof row.getCell(columns[5]).value === 'number' &&
        (row.getCell(columns[5]).numFmt ?? '').includes('%')
      )
        tax = String(Number((Number(tax) * 100).toFixed(10)));
      const product = productSchema.parse({
        ...blankProduct(currency),
        name,
        sku: cells[1],
        description: cells[2],
        unitPrice: decimal(cells[3]),
        currency: cells[4].toUpperCase() || currency,
        taxPercent: tax || null,
      });
      const key = JSON.stringify([catalogKey(product.name), product.currency]);
      const duplicate = seen.has(key);
      seen.add(key);
      rows.push({
        row: n,
        name,
        product,
        status: duplicate ? 'duplicate' : 'new',
        message: duplicate ? 'مكرر؛ سيتم تخطيه' : 'جاهز للإضافة',
      });
    } catch (error) {
      rows.push({
        row: n,
        name,
        status: 'error',
        message: errorMessage(error),
      });
    }
  }
  if (!rows.length)
    throw new Error('الجدول فارغ؛ املأ المنتجات ابتداءً من الصف الثاني');
  return { filename: basename(path), rows };
}
