import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  errorMessage,
  money,
  calculate,
  type Item,
  type Settings,
} from '../shared/domain';
import {
  mergeImportedItems,
  type DocumentImportPreview,
} from '../shared/document-import';
import { api, unwrap } from './api';
export function DocumentImport({
  currency,
  items,
  disabled,
  onApply,
  notify,
}: {
  currency: Settings['currency'];
  items: Item[];
  disabled: boolean;
  onApply: (items: Item[]) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [preview, setPreview] = useState<DocumentImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  async function read() {
    setBusy(true);
    try {
      const result = await unwrap(api().readDocumentExcel(currency));
      if (result) setPreview(result);
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    try {
      if (await unwrap(api().downloadDocumentTemplate()))
        notify('تم حفظ قالب بنود المستند');
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!preview || preview.rows.some((r) => r.error)) return;
    try {
      onApply(
        mergeImportedItems(
          items,
          preview.rows.map((r) => r.item!),
          replace,
        ),
      );
      setPreview(null);
      notify('تم ملء بنود المستند من Excel؛ احفظ المستند لتثبيت التغييرات');
    } catch (e) {
      notify(errorMessage(e), true);
    }
  }
  const errors = preview?.rows.filter((r) => r.error).length ?? 0;
  return (
    <div className="product-import">
      <div className="button-group">
        <button
          type="button"
          className="secondary"
          disabled={disabled || busy}
          onClick={() => void read()}
        >
          <Upload size={16} />
          استيراد بنود من Excel
        </button>
        <button
          type="button"
          className="secondary"
          disabled={disabled || busy}
          onClick={() => void download()}
        >
          <Download size={16} />
          تحميل قالب البنود
        </button>
      </div>
      <p className="field-help">
        املأ جدول هذا المستند من Excel: الاسم، الوصف، الكمية، السعر، الضريبة
        والخصم. العملة {currency}؛ الحد 200 بند. الكمية الفارغة = 1. الصفوف
        المتكررة تبقى بنوداً مستقلة.
      </p>
      {preview && (
        <section className="import-preview" aria-label="معاينة بنود Excel">
          <h3>
            {preview.filename} — {preview.rows.length} بند
          </h3>
          <p>
            لن تُحفظ البيانات قبل حفظ المستند. الصيغ غير مقبولة؛ استخدم لصق
            القيم فقط.
          </p>
          {errors > 0 && (
            <p role="alert">
              يوجد {errors} خطأ؛ صحح الملف وأعد اختياره قبل التطبيق.
            </p>
          )}
          <div className="table-scroll import-rows">
            <table className="document-list">
              <thead>
                <tr>
                  <th>صف</th>
                  <th>البند</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th>الخصم</th>
                  <th>الضريبة %</th>
                  <th>الإجمالي / الخطأ</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.name}</td>
                    <td>{row.item?.quantity}</td>
                    <td>{row.item?.unitPrice}</td>
                    <td>{row.item?.discount ?? '—'}</td>
                    <td>{row.item?.taxPercent ?? '—'}</td>
                    <td>
                      {row.error ??
                        (row.item
                          ? money(calculate([row.item]).total, currency)
                          : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            طريقة إدخال البنود
            <select
              aria-label="طريقة استيراد البنود"
              value={replace ? 'replace' : 'append'}
              disabled={disabled || busy}
              onChange={(e) => setReplace(e.target.value === 'replace')}
            >
              <option value="append">إضافة إلى البنود الحالية</option>
              <option value="replace">استبدال جميع البنود الحالية</option>
            </select>
          </label>
          {replace && (
            <p>
              عند التطبيق ستُزال البنود الحالية من هذه المسودة وتُستبدل بصفوف
              الملف.
            </p>
          )}
          <div className="button-group">
            <button
              type="button"
              className="primary"
              disabled={disabled || busy || errors > 0}
              onClick={apply}
            >
              تطبيق البنود على المستند
            </button>
            <button
              type="button"
              className="secondary"
              disabled={disabled || busy}
              onClick={() => void read()}
            >
              اختيار ملف آخر
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              إلغاء
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
