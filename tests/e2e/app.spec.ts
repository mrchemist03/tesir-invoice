import { test, expect, _electron as electron } from '@playwright/test';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('desktop invoice survives restart and exposes only the limited bridge', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-e2e-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, TESIR_DATA_DIR: directory }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  let app = await electron.launch({ args: ['.'], env });
  try {
    let page = await app.firstWindow();
    await expect(page.getByText('هنا تبدأ قصة أعمالك')).toBeVisible();
    expect(
      await page.evaluate(
        () => typeof (window as unknown as { require: unknown }).require,
      ),
    ).toBe('undefined');
    expect(await page.evaluate(() => typeof window.tesir?.saveDocument)).toBe(
      'function',
    );
    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await page.getByLabel('اسم الشركة', { exact: true }).fill('شركة الاختبار');
    await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ');
    await page.getByRole('button', { name: 'نظرة عامة', exact: true }).click();
    await page.getByRole('button', { name: 'مستند جديد', exact: true }).click();
    await page.getByLabel('اسم العميل', { exact: true }).fill('عميل الاختبار');
    await page.getByLabel('اسم البند 1', { exact: true }).fill('خدمة تصميم');
    await page.getByLabel('سعر الوحدة 1', { exact: true }).fill('25.10');
    await page.getByLabel('الكمية 1', { exact: true }).fill('2');
    await page.getByLabel('الضريبة 1', { exact: true }).fill('20');
    await page.getByLabel('الخصم 1', { exact: true }).fill('0.20');
    await page
      .getByRole('button', { name: 'حفظ المسودة', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('تم حفظ المسودة');
    await page.getByRole('button', { name: 'معاينة', exact: true }).click();
    await expect(page.locator('.document-paper')).toContainText(
      'عميل الاختبار',
    );
    await expect(page.locator('.document-paper')).toContainText(
      'شركة الاختبار',
    );
    mkdirSync(resolve('.tmp'), { recursive: true });
    await page.screenshot({
      path: resolve('.tmp/invoice-preview.png'),
      fullPage: true,
    });
    const pdfPath = resolve('.tmp/invoice.pdf');
    await app.evaluate(({ dialog }, path) => {
      Object.defineProperty(dialog, 'showSaveDialog', {
        value: async () => ({ canceled: false, filePath: path }),
        configurable: true,
      });
    }, pdfPath);
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('تم تصدير PDF');
    expect(readFileSync(pdfPath).subarray(0, 4).toString()).toBe('%PDF');
    await app.close();
    expect(
      readdirSync(join(directory, 'backups')).filter((name) =>
        name.endsWith('.db'),
      ).length,
    ).toBe(1);
    app = await electron.launch({ args: ['.'], env });
    page = await app.firstWindow();
    await expect(
      page.getByRole('button', { name: 'INV-00001', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'INV-00001', exact: true }).click();
    await expect(page.getByLabel('اسم العميل', { exact: true })).toHaveValue(
      'عميل الاختبار',
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'حفظ واعتماد المستند' }).click();
    await expect(page.getByRole('status')).toContainText('تم اعتماد المستند');
    await expect(page.getByLabel('اسم العميل', { exact: true })).toBeDisabled();
    await page
      .getByRole('button', { name: 'المستندات', exact: false })
      .first()
      .click();
    await page.screenshot({
      path: resolve('.tmp/dashboard.png'),
      fullPage: true,
    });
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('custom types, image templates, backup and multipage PDF work together', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tesir-template-e2e-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries({ ...process.env, TESIR_DATA_DIR: directory }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.'], env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByText('هنا تبدأ قصة أعمالك')).toBeVisible();
    await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
    await page.getByLabel('اسم النوع', { exact: true }).fill('أمر شراء');
    await page.getByLabel('بادئة الترقيم', { exact: true }).fill('PO');
    await page
      .getByRole('button', { name: 'إضافة نوع مستند', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText(
      'تمت إضافة نوع المستند',
    );
    await page
      .getByRole('button', { name: 'قوالب المستندات', exact: true })
      .click();
    await page.getByLabel('اسم القالب', { exact: true }).fill('قالب الاختبار');
    await page.getByRole('button', { name: 'حفظ القالب', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ القالب');
    const result = await page.evaluate(async () => {
      const boot = await window.tesir!.bootstrap();
      if (!boot.ok) throw new Error(boot.error);
      const type = boot.value.types.find((t) => t.prefix === 'PO')!;
      const template = boot.value.templates[0];
      const image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
      const updated = await window.tesir!.saveTemplate({
        ...template,
        background: image,
        stamp: image,
      });
      if (!updated.ok) throw new Error(updated.error);
      return window.tesir!.saveDocument({
        id: crypto.randomUUID(),
        revision: 0,
        typeId: type.id,
        date: '2026-09-05',
        clientLabel: 'السادة',
        clientName: 'عميل متعدد الصفحات',
        items: Array.from({ length: 80 }, (_, i) => ({
          id: crypto.randomUUID(),
          name: `خدمة ${i + 1}`,
          description: `SKU-${String(i + 1).padStart(3, '0')}`,
          quantity: '1',
          unitPrice: '10',
          taxPercent: null,
          discount: null,
        })),
        noteTitle: '',
        noteBody: '',
        footerNote: '',
        customFields: [{ label: 'مرجع', value: 'REFERENCE-80' }],
        templateId: template.id,
        status: 'draft',
      });
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.number).toBe('PO-00001');
    const output = resolve('.tmp/multipage.pdf');
    await app.evaluate(({ dialog }, path) => {
      Object.defineProperty(dialog, 'showSaveDialog', {
        value: async () => ({ canceled: false, filePath: path }),
        configurable: true,
      });
    }, output);
    const exported = await page.evaluate(
      (id) => window.tesir!.exportPdf(id),
      result.value.id,
    );
    expect(exported).toEqual({ ok: true, value: true });
    const pdf = readFileSync(output).toString('latin1');
    expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    const backupPath = join(directory, 'manual-backup.db');
    await app.evaluate(({ dialog }, path) => {
      Object.defineProperty(dialog, 'showSaveDialog', {
        value: async () => ({ canceled: false, filePath: path }),
        configurable: true,
      });
    }, backupPath);
    expect(await page.evaluate(() => window.tesir!.backup())).toEqual({
      ok: true,
      value: true,
    });
    expect(readFileSync(backupPath).subarray(0, 15).toString()).toBe(
      'SQLite format 3',
    );
  } finally {
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
