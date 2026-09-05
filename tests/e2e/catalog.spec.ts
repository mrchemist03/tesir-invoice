import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
test('customers and products can be reused and new invoice products are saved automatically', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-catalog-e2e-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, TESIR_DATA_DIR: directory }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app = await electron.launch({ args: ['.'], env });
  try {
    let page = await app.firstWindow();
    await expect(
      page.getByRole('button', { name: 'العملاء', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'العملاء', exact: true }).click();
    await page.getByLabel('اسم العميل في القائمة').fill('مؤسسة النور');
    await page.getByLabel('هاتف العميل').fill('555123456');
    await page.getByRole('button', { name: 'حفظ العميل', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ العميل');
    await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
    await page.getByLabel('اسم المنتج في القائمة').fill('خدمة طباعة');
    await page.getByLabel('وصف المنتج').fill('طباعة ملونة');
    await page.getByLabel('سعر المنتج').fill('45.50');
    await page.getByLabel('ضريبة المنتج').fill('10');
    await page.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ المنتج');
    await page.getByRole('button', { name: 'نظرة عامة', exact: true }).click();
    await page.getByRole('button', { name: 'مستند جديد', exact: true }).click();
    await page.getByLabel('اسم العميل', { exact: true }).fill('مؤسسة النور');
    await page.getByLabel('اسم البند 1', { exact: true }).fill('خدمة طباعة');
    await expect(page.getByLabel('سعر الوحدة 1', { exact: true })).toHaveValue(
      '45.50',
    );
    await expect(page.getByLabel('الضريبة 1', { exact: true })).toHaveValue(
      '10',
    );
    await page.getByLabel('سعر الوحدة 1', { exact: true }).fill('40');
    await page
      .getByRole('button', { name: 'إضافة بند جديد', exact: true })
      .click();
    await page.getByLabel('اسم البند 2', { exact: true }).fill('دفتر ملاحظات');
    await page.getByLabel('سعر الوحدة 2', { exact: true }).fill('15');
    await page
      .getByRole('button', { name: 'حفظ المسودة', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('تم حفظ المسودة');
    await page
      .getByRole('button', { name: 'حفظ المسودة', exact: true })
      .click();
    await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'دفتر ملاحظات', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'خدمة طباعة', exact: true }).click();
    await expect(page.getByLabel('سعر المنتج')).toHaveValue('45.50');
    await page.getByLabel('البحث في المنتجات').fill('دفتر');
    await expect(
      page.getByRole('button', { name: 'خدمة طباعة', exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('البحث في المنتجات').fill('');
    mkdirSync(resolve('.tmp'), { recursive: true });
    await page.screenshot({
      path: resolve('.tmp/products-page.png'),
      fullPage: true,
    });
    await app.close();
    app = await electron.launch({ args: ['.'], env });
    page = await app.firstWindow();
    await page.getByRole('button', { name: 'المنتجات', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'دفتر ملاحظات', exact: true }),
    ).toBeVisible();
    const data = await page.evaluate(() => window.tesir!.bootstrap());
    expect(data.ok).toBe(true);
    if (!data.ok) throw new Error(data.error);
    expect(data.value.products.length).toBe(2);
    expect(data.value.customers.length).toBe(1);
    await page
      .getByRole('button', { name: 'دفتر ملاحظات', exact: true })
      .click();
    await page.getByLabel('أرشفة وإخفاء من اقتراحات الفاتورة').check();
    await page.getByRole('button', { name: 'حفظ المنتج', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ المنتج');
    await expect(
      page.getByRole('button', { name: 'دفتر ملاحظات', exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('إظهار المؤرشف').check();
    await expect(
      page.getByRole('button', { name: 'دفتر ملاحظات', exact: true }),
    ).toBeVisible();
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
