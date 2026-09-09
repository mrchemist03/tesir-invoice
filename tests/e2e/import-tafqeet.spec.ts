import { test, expect, _electron as electron } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
test('Excel template download, preview, confirmation and automatic words survive restart and PDF export', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-features-e2e-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, TESIR_DATA_DIR: directory }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app = await electron.launch({ args: ['.'], env });
  try {
    let page = await app.firstWindow();
    await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
    const template = join(directory, 'template.xlsx');
    await app.evaluate(({ dialog }, path) => {
      Object.defineProperty(dialog, 'showSaveDialog', {
        configurable: true,
        value: async () => ({ canceled: false, filePath: path }),
      });
    }, template);
    await page
      .getByRole('button', { name: 'تحميل قالب Excel', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('تم حفظ قالب Excel');
    expect(existsSync(template)).toBe(true);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    workbook.getWorksheet('المنتجات')!.getRow(2).values = [
      'منتج مستورد',
      '001',
      'وصف مستورد',
      100,
      'TRY',
      20,
    ];
    const file = join(directory, 'filled.xlsx');
    await workbook.xlsx.writeFile(file);
    await app.evaluate(({ dialog }, path) => {
      Object.defineProperty(dialog, 'showOpenDialog', {
        configurable: true,
        value: async () => ({ canceled: false, filePaths: [path] }),
      });
    }, file);
    await page
      .getByRole('button', { name: 'استيراد من Excel', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'معاينة استيراد المنتجات' }),
    ).toBeVisible();
    let data = await page.evaluate(() => window.tesir!.bootstrap());
    if (!data.ok) throw new Error(data.error);
    expect(data.value.products).toHaveLength(0);
    mkdirSync(resolve('.tmp'), { recursive: true });
    await page.screenshot({
      path: resolve('.tmp/import-preview.png'),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'تأكيد استيراد 1 منتج', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('تم استيراد 1 منتج');
    await page
      .getByRole('button', { name: 'استيراد من Excel', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'تأكيد استيراد 0 منتج', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'إلغاء الاستيراد', exact: true })
      .click();
    await page.getByRole('button', { name: 'نظرة عامة', exact: true }).click();
    await page.getByRole('button', { name: 'مستند جديد', exact: true }).click();
    await expect(
      page.getByLabel('تفقيط الإجمالي تلقائياً في المستند'),
    ).toBeChecked();
    await page.getByLabel('اسم العميل', { exact: true }).fill('عميل التفقيط');
    await page.getByLabel('اسم البند 1', { exact: true }).fill('منتج مستورد');
    await expect(page.getByLabel('سعر الوحدة 1', { exact: true })).toHaveValue(
      '100',
    );
    await page
      .getByRole('button', { name: 'حفظ المسودة', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('تم حفظ المسودة');
    data = await page.evaluate(() => window.tesir!.bootstrap());
    if (!data.ok) throw new Error(data.error);
    const id = data.value.documents[0].id;
    const saved = await page.evaluate(
      (id) => window.tesir!.getDocument(id),
      id,
    );
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.value.amountInWords).toBe('مائة وعشرون ليرة تركية فقط لا غير');
    await page.getByRole('button', { name: /معاينة/ }).click();
    await expect(page.locator('.paper-words')).toContainText(
      saved.value.amountInWords!,
    );
    await page.screenshot({
      path: resolve('.tmp/tafqeet-preview.png'),
      fullPage: true,
    });
    const pdf = resolve('.tmp/tafqeet-test.pdf');
    await app.evaluate(({ dialog }, path) => {
      Object.defineProperty(dialog, 'showSaveDialog', {
        configurable: true,
        value: async () => ({ canceled: false, filePath: path }),
      });
    }, pdf);
    const exported = await page.evaluate(
      (id) => window.tesir!.exportPdf(id),
      id,
    );
    expect(exported).toEqual({ ok: true, value: true });
    expect(existsSync(pdf)).toBe(true);
    await app.close();
    app = await electron.launch({ args: ['.'], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole('button', { name: 'المنتجات', exact: true }),
    ).toBeVisible();
    const reopened = await page.evaluate(
      (id) => window.tesir!.getDocument(id),
      id,
    );
    expect(reopened).toEqual(saved);
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
