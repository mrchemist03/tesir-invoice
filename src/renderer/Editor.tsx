import { amountInWords } from '../shared/tafqeet';
import { useState } from 'react';
import { catalogKey } from '../shared/catalog';
import { Copy, Eye, FileDown, Plus, Printer, Save, Trash2 } from 'lucide-react';
import {
  calculate,
  errorMessage,
  money,
  newItem,
  type Bootstrap,
  type DocumentInput,
  type SavedDocument,
} from '../shared/domain';
import { DocumentView, documentStyles } from '../shared/DocumentView';
import { api, unwrap } from './api';
type Props = {
  initial: DocumentInput | SavedDocument;
  data: Bootstrap;
  onDirty: (dirty: boolean) => void;
  notify: (message: string, error?: boolean) => void;
  onSaved: (document: SavedDocument) => Promise<void>;
  onClone: (document: SavedDocument) => void;
};
export function Editor({
  initial,
  data,
  onDirty,
  notify,
  onSaved,
  onClone,
}: Props) {
  const [doc, setDoc] = useState<DocumentInput | SavedDocument>(initial);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(initial.revision === 0);
  const locked = doc.status === 'final' && doc.revision > 0;
  const currency = doc.currency ?? data.settings.currency;
  const customers = data.customers.filter((customer) => !customer.archived);
  const products = data.products.filter(
    (product) => !product.archived && product.currency === currency,
  );
  let totals;
  try {
    totals = calculate(
      doc.items.map((item) => ({ ...item, name: item.name || 'بند' })),
    );
  } catch {
    totals = null;
  }
  const previewDocument: SavedDocument | null = totals
    ? {
        ...doc,
        number: 'number' in doc && doc.number ? doc.number : 'مسودة جديدة',
        typeName: data.types.find((t) => t.id === doc.typeId)?.name ?? '',
        currency,
        company: 'company' in doc && !dirty ? doc.company : data.settings,
        template:
          'template' in doc && !dirty
            ? doc.template
            : (data.templates.find((t) => t.id === doc.templateId) ?? null),
        amountInWords:
          !dirty && 'amountInWords' in doc
            ? doc.amountInWords
            : doc.showAmountInWords
              ? amountInWords(totals.total, currency)
              : undefined,
        totals,
        createdAt: '',
        updatedAt: '',
      }
    : null;
  function update(patch: Partial<DocumentInput>) {
    setDoc((current) => ({ ...current, ...patch }));
    setDirty(true);
    onDirty(true);
  }
  function setCustomerName(name: string) {
    const customer = customers.find(
      (value) => catalogKey(value.name) === catalogKey(name),
    );
    update({ clientName: name, customerId: customer?.id ?? null });
  }
  function setProductName(id: string, name: string) {
    const product = products.find(
      (value) => catalogKey(value.name) === catalogKey(name),
    );
    update({
      items: doc.items.map((item) =>
        item.id !== id
          ? item
          : product
            ? {
                ...item,
                name: product.name,
                productId: product.id,
                description: product.description,
                unitPrice: product.unitPrice,
                taxPercent: product.taxPercent,
              }
            : { ...item, name, productId: null },
      ),
    });
  }
  async function save(final = false) {
    if (
      final &&
      !window.confirm(
        'اعتماد المستند يثبّت محتواه ويمنع تعديله. هل تريد المتابعة؟',
      )
    )
      return;
    setBusy(true);
    try {
      const saved = await unwrap(
        api().saveDocument({ ...doc, status: final ? 'final' : 'draft' }),
      );
      setDoc(saved);
      setDirty(false);
      onDirty(false);
      await onSaved(saved);
      notify(final ? 'تم اعتماد المستند' : 'تم حفظ المسودة');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  async function output(print: boolean) {
    if (dirty || !doc.revision) {
      notify('احفظ التغييرات أولاً لتصدير النسخة المحفوظة', true);
      return;
    }
    setBusy(true);
    try {
      const done = await unwrap(
        print ? api().printDocument(doc.id) : api().exportPdf(doc.id),
      );
      if (done) notify(print ? 'تم إرسال المستند للطباعة' : 'تم تصدير PDF');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="editor">
      <datalist id="catalog-customers">
        {customers.map((customer) => (
          <option key={customer.id} value={customer.name}>
            {customer.phone}
          </option>
        ))}
      </datalist>
      <datalist id="catalog-products">
        {products.map((product) => (
          <option key={product.id} value={product.name}>
            {product.sku} ·{' '}
            {money(
              Math.round(Number(product.unitPrice) * 100),
              product.currency,
            )}
          </option>
        ))}
      </datalist>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={doc.showAmountInWords ?? false}
          disabled={locked || busy}
          onChange={(e) => update({ showAmountInWords: e.target.checked })}
        />
        تفقيط الإجمالي تلقائياً في المستند
      </label>
      <div className="editor-toolbar">
        <div className="toolbar-title">
          <span className={`status ${locked ? 'final' : 'draft'}`}>
            {locked ? 'معتمد' : 'مسودة'}
          </span>
          <strong dir="ltr">
            {'number' in doc ? doc.number : 'مستند جديد'}
          </strong>
          <small>{dirty ? 'تغييرات غير محفوظة' : 'محفوظ على جهازك'}</small>
        </div>
        <div className="button-group">
          <button className="secondary" onClick={() => setPreview(!preview)}>
            <Eye size={16} />
            {preview ? 'العودة للتحرير' : 'معاينة'}
          </button>
          <button
            className="secondary"
            disabled={busy || dirty || !doc.revision}
            onClick={() => void output(false)}
          >
            <FileDown size={16} />
            PDF
          </button>
          <button
            className="secondary"
            disabled={busy || dirty || !doc.revision}
            onClick={() => void output(true)}
          >
            <Printer size={16} />
            طباعة
          </button>
          {locked ? (
            <button
              className="primary"
              onClick={() => onClone(doc as SavedDocument)}
            >
              <Copy size={16} />
              نسخ كمستند جديد
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={16} />
              {busy ? 'جارٍ الحفظ…' : 'حفظ المسودة'}
            </button>
          )}
        </div>
      </div>
      {locked && (
        <div className="info-banner">
          هذا المستند معتمد. بيانات الشركة والقالب والحسابات محفوظة معه للحفاظ
          على نسخته الأصلية.
        </div>
      )}
      {preview ? (
        <div className="preview-surface">
          <style>{documentStyles}</style>
          {previewDocument ? (
            <DocumentView document={previewDocument} />
          ) : (
            <p>صحح قيم البنود لعرض المعاينة.</p>
          )}
          <p className="preview-caption">
            معاينة المحتوى · تقسيم الصفحات النهائي يظهر في ملف PDF
          </p>
        </div>
      ) : (
        <div className="editor-grid">
          <div>
            <fieldset disabled={locked || busy}>
              <section className="panel form-section">
                <div className="section-title">
                  <h2>
                    <span className="step-number">01</span>بيانات المستند
                  </h2>
                </div>
                <div className="form-grid">
                  <label>
                    نوع المستند
                    <select
                      value={doc.typeId}
                      disabled={doc.revision > 0}
                      onChange={(e) => update({ typeId: e.target.value })}
                    >
                      {data.types.map((type) => (
                        <option value={type.id} key={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    التاريخ
                    <input
                      type="date"
                      value={doc.date}
                      onChange={(e) => update({ date: e.target.value })}
                    />
                  </label>
                  <label>
                    تسمية العميل
                    <input
                      value={doc.clientLabel}
                      maxLength={80}
                      onChange={(e) => update({ clientLabel: e.target.value })}
                    />
                  </label>
                  <label>
                    اسم العميل <span className="required">*</span>
                    <input
                      aria-label="اسم العميل"
                      list="catalog-customers"
                      placeholder="اختر عميلاً أو اكتب اسماً جديداً"
                      value={doc.clientName}
                      maxLength={200}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </label>
                  <label className="span-two">
                    قالب المستند
                    <select
                      value={doc.templateId ?? ''}
                      onChange={(e) =>
                        update({ templateId: e.target.value || null })
                      }
                    >
                      <option value="">قالب تأثير البسيط</option>
                      {data.templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="panel form-section">
                <div className="section-title">
                  <h2>
                    <span className="step-number">02</span>البنود والخدمات
                  </h2>
                  <span className="count-label">{doc.items.length} بند</span>
                </div>
                <p className="field-help">
                  تظهر المنتجات بعملة المستند ({currency}). المنتجات والعملاء
                  الجدد يُحفظون تلقائياً عند حفظ المستند.
                </p>
                <div className="items-list">
                  {doc.items.map((item, index) => (
                    <div className="item-card" key={item.id}>
                      <div className="item-heading">
                        <span>البند {index + 1}</span>
                        <button
                          className="icon-button danger"
                          aria-label={`حذف البند ${index + 1}`}
                          disabled={doc.items.length === 1}
                          onClick={() =>
                            update({
                              items: doc.items.filter((x) => x.id !== item.id),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="form-grid">
                        <label className="span-two">
                          اسم البند
                          <input
                            aria-label={`اسم البند ${index + 1}`}
                            list="catalog-products"
                            value={item.name}
                            maxLength={300}
                            placeholder="اختر منتجاً محفوظاً أو اكتب منتجاً جديداً"
                            onChange={(e) =>
                              setProductName(item.id, e.target.value)
                            }
                          />
                        </label>
                        <label>
                          الكمية
                          <input
                            aria-label={`الكمية ${index + 1}`}
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(e) =>
                              update({
                                items: doc.items.map((x) =>
                                  x.id === item.id
                                    ? { ...x, quantity: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          سعر الوحدة ({currency})
                          <input
                            aria-label={`سعر الوحدة ${index + 1}`}
                            inputMode="decimal"
                            value={item.unitPrice}
                            onChange={(e) =>
                              update({
                                items: doc.items.map((x) =>
                                  x.id === item.id
                                    ? { ...x, unitPrice: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label className="span-two">
                          الوصف <small>اختياري</small>
                          <input
                            value={item.description}
                            maxLength={1000}
                            placeholder="تفاصيل إضافية عن البند"
                            onChange={(e) =>
                              update({
                                items: doc.items.map((x) =>
                                  x.id === item.id
                                    ? { ...x, description: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          الضريبة % <small>اختياري</small>
                          <input
                            aria-label={`الضريبة ${index + 1}`}
                            inputMode="decimal"
                            placeholder="بدون ضريبة"
                            value={item.taxPercent ?? ''}
                            onChange={(e) =>
                              update({
                                items: doc.items.map((x) =>
                                  x.id === item.id
                                    ? {
                                        ...x,
                                        taxPercent: e.target.value || null,
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          الخصم ({currency}) <small>اختياري</small>
                          <input
                            aria-label={`الخصم ${index + 1}`}
                            inputMode="decimal"
                            placeholder="بدون خصم"
                            value={item.discount ?? ''}
                            onChange={(e) =>
                              update({
                                items: doc.items.map((x) =>
                                  x.id === item.id
                                    ? { ...x, discount: e.target.value || null }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="item-total">
                        إجمالي البند{' '}
                        <strong>
                          {totals
                            ? money(totals.lines[index].total, currency)
                            : 'تحقق من القيم'}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="add-row"
                  disabled={doc.items.length >= 200}
                  onClick={() => update({ items: [...doc.items, newItem()] })}
                >
                  <Plus size={17} />
                  إضافة بند جديد
                </button>
              </section>
              <section className="panel form-section">
                <div className="section-title">
                  <h2>
                    <span className="step-number">03</span>تفاصيل إضافية
                  </h2>
                  <small>الحقول الفارغة لا تظهر في الطباعة</small>
                </div>
                <div className="form-grid">
                  <label className="span-two">
                    عنوان الملاحظة
                    <input
                      value={doc.noteTitle}
                      maxLength={150}
                      onChange={(e) => update({ noteTitle: e.target.value })}
                    />
                  </label>
                  <label className="span-two">
                    الملاحظات
                    <textarea
                      rows={3}
                      value={doc.noteBody}
                      maxLength={3000}
                      placeholder="شروط الدفع أو أي تفاصيل ترغب بإضافتها…"
                      onChange={(e) => update({ noteBody: e.target.value })}
                    />
                  </label>
                  <label className="span-two">
                    ملاحظة أسفل المستند
                    <input
                      value={doc.footerNote}
                      maxLength={1000}
                      onChange={(e) => update({ footerNote: e.target.value })}
                    />
                  </label>
                </div>
                {doc.customFields.map((field, index) => (
                  <div className="custom-field-row" key={index}>
                    <input
                      aria-label={`عنوان الحقل ${index + 1}`}
                      placeholder="اسم الحقل"
                      value={field.label}
                      onChange={(e) =>
                        update({
                          customFields: doc.customFields.map((x, i) =>
                            i === index ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`قيمة الحقل ${index + 1}`}
                      placeholder="القيمة"
                      value={field.value}
                      onChange={(e) =>
                        update({
                          customFields: doc.customFields.map((x, i) =>
                            i === index ? { ...x, value: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button danger"
                      aria-label="حذف الحقل"
                      onClick={() =>
                        update({
                          customFields: doc.customFields.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-button"
                  disabled={doc.customFields.length >= 20}
                  onClick={() =>
                    update({
                      customFields: [
                        ...doc.customFields,
                        { label: '', value: '' },
                      ],
                    })
                  }
                >
                  <Plus size={16} />
                  إضافة حقل مخصص
                </button>
              </section>
            </fieldset>
          </div>
          <aside className="summary-card panel">
            <div className="section-title">
              <h2>ملخص المستند</h2>
            </div>
            <div className="summary-body">
              <div>
                <span>المجموع الفرعي</span>
                <b>{totals ? money(totals.subtotal, currency) : '—'}</b>
              </div>
              <div>
                <span>الخصم</span>
                <b>{totals ? money(totals.discount, currency) : '—'}</b>
              </div>
              <div>
                <span>الضريبة</span>
                <b>{totals ? money(totals.tax, currency) : '—'}</b>
              </div>
              <div className="summary-total">
                <span>الإجمالي المستحق</span>
                <strong>{totals ? money(totals.total, currency) : '—'}</strong>
              </div>
              <p>
                تُحسب الضريبة بعد الخصم، ويُقرّب كل بند إلى أصغر وحدة للعملة.
              </p>
              {!locked && (
                <button
                  className="primary full-width"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  حفظ واعتماد المستند
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
