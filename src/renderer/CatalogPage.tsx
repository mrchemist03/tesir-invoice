import { useState } from 'react';
import { Package, Pencil, Plus, Save, Search, Users } from 'lucide-react';
import {
  blankCustomer,
  blankProduct,
  catalogKey,
  customerSchema,
  productSchema,
  type Customer,
  type Product,
} from '../shared/catalog';
import { errorMessage, money, type Bootstrap } from '../shared/domain';
import { api, unwrap } from './api';
type Props = {
  kind: 'customers' | 'products';
  data: Bootstrap;
  reload: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
  onDirty: (value: boolean) => void;
};
export function CatalogPage({ kind, data, reload, notify, onDirty }: Props) {
  const customers = kind === 'customers';
  const [record, setRecord] = useState<Customer | Product>(() =>
    customers ? blankCustomer() : blankProduct(data.settings.currency),
  );
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const entries = (customers ? data.customers : data.products).filter(
    (entry) =>
      (showArchived || !entry.archived) &&
      catalogKey(
        [
          entry.name,
          'phone' in entry ? entry.phone : entry.sku,
          'email' in entry ? entry.email : entry.description,
        ].join(' '),
      ).includes(catalogKey(query)),
  );
  function choose(value: Customer | Product) {
    if (dirty && !window.confirm('تجاهل التغييرات غير المحفوظة؟')) return;
    setRecord(value);
    setDirty(false);
    onDirty(false);
  }
  function update(patch: Partial<Customer & Product>) {
    setRecord((current) => ({ ...current, ...patch }));
    setDirty(true);
    onDirty(true);
  }
  async function save() {
    setBusy(true);
    try {
      const saved =
        'phone' in record
          ? await unwrap(api().saveCustomer(customerSchema.parse(record)))
          : await unwrap(api().saveProduct(productSchema.parse(record)));
      setRecord(saved);
      setDirty(false);
      onDirty(false);
      await reload();
      notify(customers ? 'تم حفظ العميل' : 'تم حفظ المنتج');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="catalog-layout">
      <section className="panel catalog-list">
        <div className="section-title">
          <div>
            <h2>{customers ? 'قائمة العملاء' : 'قائمة المنتجات'}</h2>
            <p>
              {customers
                ? 'معلومات التواصل، محفوظة ويسهل الرجوع إليها.'
                : 'أسعارك وأوصافك، جاهزة لكل مستند جديد.'}
            </p>
          </div>
          <span className="count-label">
            {entries.length} {customers ? 'عميل' : 'منتج'}
          </span>
        </div>
        <div className="catalog-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label={customers ? 'البحث في العملاء' : 'البحث في المنتجات'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                customers ? 'الاسم أو الهاتف أو البريد…' : 'اسم المنتج أو رمزه…'
              }
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            إظهار المؤرشف
          </label>
        </div>
        {entries.length ? (
          <div className="table-scroll">
            <table className="document-list">
              <thead>
                <tr>
                  <th>{customers ? 'العميل' : 'المنتج'}</th>
                  <th>{customers ? 'التواصل' : 'السعر الافتراضي'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={entry.id === record.id ? 'selected-row' : ''}
                  >
                    <td>
                      <button
                        className="catalog-name"
                        onClick={() => choose(entry)}
                      >
                        {entry.name}
                      </button>
                      <small className="catalog-meta">
                        {'phone' in entry
                          ? entry.address
                          : entry.sku || entry.description}
                      </small>
                      {entry.archived && (
                        <span className="status draft">مؤرشف</span>
                      )}
                    </td>
                    <td>
                      {'phone' in entry ? (
                        <>
                          <span dir="ltr">{entry.phone || '—'}</span>
                          <small className="catalog-meta" dir="ltr">
                            {entry.email}
                          </small>
                        </>
                      ) : (
                        <>
                          <strong>
                            {money(
                              Math.round(Number(entry.unitPrice) * 100),
                              entry.currency,
                            )}
                          </strong>
                          <small className="catalog-meta">
                            {entry.taxPercent === null
                              ? 'بدون ضريبة'
                              : `ضريبة ${entry.taxPercent}%`}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`تعديل ${entry.name}`}
                        onClick={() => choose(entry)}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              {customers ? <Users size={30} /> : <Package size={30} />}
            </div>
            <h3>
              {query
                ? 'لا توجد نتائج مطابقة'
                : customers
                  ? 'ابدأ بقائمة عملائك'
                  : 'منتجاتك تبدأ من هنا'}
            </h3>
            <p>
              {query
                ? 'جرّب اسماً آخر أو أظهر العناصر المؤرشفة.'
                : customers
                  ? 'أضف عميلاً من النموذج أو احفظ مستنداً باسمه.'
                  : 'أضف منتجاً هنا، أو اكتبه في فاتورة وسيُحفظ عند حفظها.'}
            </p>
          </div>
        )}
        <p className="catalog-footnote">
          {customers
            ? 'تعديل بيانات العميل لا يغيّر المستندات السابقة.'
            : 'تعديل السعر داخل الفاتورة يخص تلك الفاتورة فقط. عدّل السعر الافتراضي من هذه القائمة.'}
        </p>
      </section>
      <section className="panel form-section catalog-editor">
        <div className="section-title">
          <h2>
            {record.revision
              ? customers
                ? 'تعديل العميل'
                : 'تعديل المنتج'
              : customers
                ? 'عميل جديد'
                : 'منتج جديد'}
          </h2>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              choose(
                customers
                  ? blankCustomer()
                  : blankProduct(data.settings.currency),
              )
            }
          >
            <Plus size={16} />
            {customers ? 'عميل جديد' : 'منتج جديد'}
          </button>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label className="span-two">
                {customers ? 'اسم العميل (مطلوب)' : 'اسم المنتج (مطلوب)'}
                <input
                  aria-label={
                    customers
                      ? 'اسم العميل في القائمة'
                      : 'اسم المنتج في القائمة'
                  }
                  required
                  maxLength={customers ? 200 : 300}
                  value={record.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              {'phone' in record ? (
                <>
                  <label>
                    الهاتف
                    <input
                      aria-label="هاتف العميل"
                      dir="ltr"
                      maxLength={80}
                      value={record.phone}
                      onChange={(e) => update({ phone: e.target.value })}
                    />
                  </label>
                  <label>
                    البريد الإلكتروني
                    <input
                      aria-label="بريد العميل"
                      type="email"
                      dir="ltr"
                      maxLength={200}
                      value={record.email}
                      onChange={(e) => update({ email: e.target.value })}
                    />
                  </label>
                  <label className="span-two">
                    العنوان
                    <textarea
                      aria-label="عنوان العميل"
                      rows={2}
                      maxLength={500}
                      value={record.address}
                      onChange={(e) => update({ address: e.target.value })}
                    />
                  </label>
                  <label className="span-two">
                    الرقم الضريبي
                    <input
                      maxLength={100}
                      value={record.taxNumber}
                      onChange={(e) => update({ taxNumber: e.target.value })}
                    />
                  </label>
                  <label className="span-two">
                    ملاحظات داخلية
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={record.notes}
                      onChange={(e) => update({ notes: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="span-two">
                    رمز المنتج (اختياري)
                    <input
                      aria-label="رمز المنتج"
                      maxLength={80}
                      value={record.sku}
                      onChange={(e) => update({ sku: e.target.value })}
                    />
                  </label>
                  <label className="span-two">
                    الوصف
                    <textarea
                      aria-label="وصف المنتج"
                      rows={3}
                      maxLength={1000}
                      value={record.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                  </label>
                  <label>
                    سعر الوحدة
                    <input
                      aria-label="سعر المنتج"
                      inputMode="decimal"
                      value={record.unitPrice}
                      onChange={(e) => update({ unitPrice: e.target.value })}
                    />
                  </label>
                  <label>
                    العملة
                    <select
                      aria-label="عملة المنتج"
                      disabled={record.revision > 0}
                      value={record.currency}
                      onChange={(e) =>
                        update({
                          currency: e.target.value as Product['currency'],
                        })
                      }
                    >
                      {['TRY', 'USD', 'EUR', 'SAR', 'AED'].map((currency) => (
                        <option key={currency}>{currency}</option>
                      ))}
                    </select>
                  </label>
                  <label className="span-two">
                    الضريبة % (اختياري)
                    <input
                      aria-label="ضريبة المنتج"
                      inputMode="decimal"
                      value={record.taxPercent ?? ''}
                      placeholder="بدون ضريبة"
                      onChange={(e) =>
                        update({ taxPercent: e.target.value || null })
                      }
                    />
                  </label>
                </>
              )}
            </div>
            <label className="checkbox-label archive-field">
              <input
                type="checkbox"
                checked={record.archived}
                onChange={(e) => update({ archived: e.target.checked })}
              />
              أرشفة وإخفاء من اقتراحات الفاتورة
            </label>
            <button className="primary full-width" type="submit">
              <Save size={16} />
              {busy ? 'جارٍ الحفظ…' : customers ? 'حفظ العميل' : 'حفظ المنتج'}
            </button>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
