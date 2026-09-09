import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { ImportPreview } from '../shared/product-import';
import { errorMessage } from '../shared/domain';
import { api, unwrap } from './api';
export function ProductImport({
  reload,
  notify,
}: {
  reload: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      if (await unwrap(api().downloadProductsTemplate()))
        notify('تم حفظ قالب Excel؛ املأ ورقة المنتجات ثم استورد الملف');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  async function read() {
    setBusy(true);
    try {
      const result = await unwrap(api().readProductsExcel());
      if (result) setPreview(result);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview || preview.rows.some((r) => r.status === 'error')) return;
    setBusy(true);
    try {
      const products = preview.rows.flatMap((row) =>
        row.status === 'new' && row.product ? [row.product] : [],
      );
      const result = await unwrap(api().importProducts(products));
      const skipped =
        preview.rows.filter((r) => r.status === 'duplicate').length +
        result.skipped;
      setPreview(null);
      await reload();
      notify(`تم استيراد ${result.added} منتج؛ تم تخطي ${skipped} مكرر`);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  const counts = { new: 0, duplicate: 0, error: 0 };
  preview?.rows.forEach((row) => counts[row.status]++);
  return (
    <div className="product-import">
      <div className="button-group">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void download()}
        >
          <Download size={16} />
          تحميل قالب Excel
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void read()}
        >
          <Upload size={16} />
          {busy ? 'جارٍ المعالجة…' : 'استيراد من Excel'}
        </button>
      </div>
      <p className="catalog-footnote">
        املأ القالب أو الصق فيه قيماً من Excel آخر. الصيغة XLSX، حتى 5000 منتج.
        ستراجع البيانات قبل حفظها.
      </p>
      {preview && (
        <section
          className="import-preview"
          aria-label="معاينة استيراد المنتجات"
        >
          <h3>مراجعة الاستيراد — {preview.filename}</h3>
          <p>
            {counts.new} جديد · {counts.duplicate} مكرر · {counts.error} خطأ
          </p>
          <p>
            يُتخطّى الاسم المكرر بنفس العملة، بما فيه المؤرشف. تبقى بيانات
            المنتجات الموجودة كما هي.
          </p>
          {counts.error > 0 && (
            <p role="alert">
              صحّح الصفوف التالية في Excel وأعد اختيار الملف؛ لن يتم الحفظ حتى
              تصحيح جميع الأخطاء.
            </p>
          )}
          <div className="table-scroll import-rows">
            <table className="document-list">
              <thead>
                <tr>
                  <th>صف Excel</th>
                  <th>المنتج</th>
                  <th>السعر / العملة</th>
                  <th>الضريبة %</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.name || '—'}</td>
                    <td>
                      {row.product?.unitPrice} {row.product?.currency}
                    </td>
                    <td>{row.product?.taxPercent ?? '—'}</td>
                    <td
                      className={row.status === 'error' ? 'import-error' : ''}
                    >
                      {row.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-group">
            <button
              className="primary"
              disabled={busy || counts.error > 0 || !counts.new}
              onClick={() => void save()}
            >
              تأكيد استيراد {counts.new} منتج
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void read()}
            >
              اختيار ملف آخر
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              إلغاء الاستيراد
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
