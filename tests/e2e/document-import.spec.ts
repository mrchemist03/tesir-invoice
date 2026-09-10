import { test, expect, _electron as electron } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
test('document editor imports Excel into draft lines, appends or replaces, and saves new products only with document', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tesir-document-import-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, TESIR_DATA_DIR: dir }).filter(
      (e): e is [string, string] => typeof e[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], env });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'مستند جديد', exact: true }).click();
    await page.getByLabel('اسم العميل', { exact: true }).fill('عميل Excel');
    const path = join(dir, 'lines.xlsx');
    await app.evaluate(
      ({ dialog }, p) =>
        Object.defineProperty(dialog, 'showSaveDialog', {
          configurable: true,
          value: async () => ({ canceled: false, filePath: p }),
        }),
      path,
    );
    await page
      .getByRole('button', { name: 'تحميل قالب البنود', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText(
      'تم حفظ قالب بنود المستند',
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(path);
    book.getWorksheet('البنود')!.getRow(2).values = [
      'بند من Excel',
      'وصف',
      2,
      25,
      20,
      5,
    ];
    await book.xlsx.writeFile(path);
    await app.evaluate(
      ({ dialog }, p) =>
        Object.defineProperty(dialog, 'showOpenDialog', {
          configurable: true,
          value: async () => ({ canceled: false, filePaths: [p] }),
        }),
      path,
    );
    await page
      .getByRole('button', { name: 'استيراد بنود من Excel', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'معاينة بنود Excel' }),
    ).toBeVisible();
    await expect(page.getByLabel('اسم البند 1', { exact: true })).toHaveValue(
      '',
    );
    await page
      .getByRole('button', { name: 'تطبيق البنود على المستند', exact: true })
      .click();
    await expect(page.getByLabel('الكمية 1', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('سعر الوحدة 1', { exact: true })).toHaveValue(
      '25',
    );
    let data = await page.evaluate(() => window.tesir!.bootstrap());
    if (!data.ok) throw Error(data.error);
    expect(data.value.products).toHaveLength(0);
    expect(data.value.documents).toHaveLength(0);
    await page
      .getByRole('button', { name: 'استيراد بنود من Excel', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'تطبيق البنود على المستند', exact: true })
      .click();
    await expect(page.getByLabel('اسم البند 2', { exact: true })).toHaveValue(
      'بند من Excel',
    );
    await page
      .getByRole('button', { name: 'استيراد بنود من Excel', exact: true })
      .click();
    await page.getByLabel('طريقة استيراد البنود').selectOption('replace');
    await page.screenshot({
      path: resolve('.tmp/document-import-preview.png'),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'تطبيق البنود على المستند', exact: true })
      .click();
    await expect(page.getByLabel('اسم البند 2', { exact: true })).toHaveCount(
      0,
    );
    await page
      .getByRole('button', { name: 'حفظ المسودة', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('تم حفظ المسودة');
    data = await page.evaluate(() => window.tesir!.bootstrap());
    if (!data.ok) throw Error(data.error);
    expect(data.value.products).toHaveLength(1);
    expect(data.value.documents[0].total).toBe(5400);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
