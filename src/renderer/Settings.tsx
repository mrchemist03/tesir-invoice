import { useState } from 'react';
import {
  DatabaseBackup,
  ImagePlus,
  Plus,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  errorMessage,
  type Bootstrap,
  type Settings,
  type Template,
} from '../shared/domain';
import { api, unwrap } from './api';
type Props = {
  data: Bootstrap;
  reload: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  onDirty: (value: boolean) => void;
};
export function SettingsPage({ data, reload, notify, onDirty }: Props) {
  const [settings, setSettings] = useState(data.settings);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [busy, setBusy] = useState(false);
  function update(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }));
    onDirty(true);
  }
  async function save() {
    setBusy(true);
    try {
      await unwrap(api().saveSettings(settings));
      await reload();
      onDirty(false);
      notify('تم حفظ إعدادات الشركة');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  async function addType() {
    setBusy(true);
    try {
      await unwrap(
        api().addType({ id: `custom-${crypto.randomUUID()}`, name, prefix }),
      );
      setName('');
      setPrefix('');
      await reload();
      notify('تمت إضافة نوع المستند');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  async function backup() {
    setBusy(true);
    try {
      if (await unwrap(api().backup()))
        notify('تم حفظ نسخة احتياطية تشمل المستندات والقوالب والإعدادات');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel form-section">
        <div className="section-title">
          <h2>بيانات الشركة</h2>
          <span className="count-label">تظهر على المستندات</span>
        </div>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label className="span-two">
              اسم الشركة
              <input
                aria-label="اسم الشركة"
                value={settings.companyName}
                onChange={(e) => update({ companyName: e.target.value })}
              />
            </label>
            <label className="span-two">
              العنوان
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => update({ address: e.target.value })}
              />
            </label>
            <label>
              رقم الهاتف
              <input
                dir="ltr"
                value={settings.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </label>
            <label>
              البريد الإلكتروني
              <input
                dir="ltr"
                type="email"
                value={settings.email}
                onChange={(e) => update({ email: e.target.value })}
              />
            </label>
            <label>
              العملة الافتراضية
              <select
                value={settings.currency}
                onChange={(e) =>
                  update({ currency: e.target.value as Settings['currency'] })
                }
              >
                {[
                  { id: 'TRY', name: 'ليرة تركية' },
                  { id: 'USD', name: 'دولار أمريكي' },
                  { id: 'EUR', name: 'يورو' },
                  { id: 'SAR', name: 'ريال سعودي' },
                  { id: 'AED', name: 'درهم إماراتي' },
                ].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              تسمية العميل الافتراضية
              <input
                value={settings.clientLabel}
                onChange={(e) => update({ clientLabel: e.target.value })}
              />
            </label>
          </div>
          <p className="field-help">
            تغيير العملة يؤثر على المستندات الجديدة فقط. المستندات المعتمدة
            تحتفظ ببيانات الشركة والقالب وقت اعتمادها.
          </p>
          <button className="primary" onClick={() => void save()}>
            <Save size={16} />
            حفظ الإعدادات
          </button>
        </fieldset>
      </section>
      <div>
        <section className="panel form-section backup-card">
          <div className="large-icon">
            <DatabaseBackup size={28} />
          </div>
          <h2>نسخة إضافية، راحة أكبر.</h2>
          <p>
            تُنشأ نسخة محلية عند إغلاق التطبيق مع الاحتفاظ بآخر 7 نسخ. احفظ نسخة
            خارج الجهاز لحمايتها من فقدانه.
          </p>
          <button
            className="secondary full-width"
            disabled={busy}
            onClick={() => void backup()}
          >
            <DatabaseBackup size={17} />
            حفظ نسخة احتياطية
          </button>
          <small>
            <ShieldCheck size={14} />
            تشمل البيانات والقوالب والأختام
          </small>
        </section>
        <section className="panel form-section">
          <h2>أنواع المستندات</h2>
          <div className="type-tags">
            {data.types.map((type) => (
              <span key={type.id}>
                {type.name}
                <small dir="ltr">{type.prefix}</small>
              </span>
            ))}
          </div>
          <div className="form-grid">
            <label>
              اسم النوع
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: أمر شراء"
              />
            </label>
            <label>
              بادئة الترقيم
              <input
                dir="ltr"
                value={prefix}
                maxLength={12}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="PO"
              />
            </label>
          </div>
          <button
            className="text-button"
            disabled={busy || !name || !prefix}
            onClick={() => void addType()}
          >
            <Plus size={16} />
            إضافة نوع مستند
          </button>
        </section>
      </div>
    </div>
  );
}
function blankTemplate(): Template {
  return {
    id: crypto.randomUUID(),
    name: '',
    background: null,
    stamp: null,
    stampX: 10,
    stampY: 75,
    stampWidth: 18,
    marginTop: 30,
    marginBottom: 25,
  };
}
export function TemplatesPage({ data, reload, notify, onDirty }: Props) {
  const [template, setTemplate] = useState<Template>(
    data.templates[0] ?? blankTemplate(),
  );
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  function update(patch: Partial<Template>) {
    setTemplate((current) => ({ ...current, ...patch }));
    setDirty(true);
    onDirty(true);
  }
  function select(value: Template) {
    if (dirty && !window.confirm('تجاهل تغييرات القالب غير المحفوظة؟')) return;
    setTemplate(value);
    setDirty(false);
    onDirty(false);
  }
  async function image(target: 'background' | 'stamp') {
    setBusy(true);
    try {
      const image = await unwrap(api().importImage());
      if (image) update({ [target]: image });
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await unwrap(api().saveTemplate(template));
      await reload();
      setDirty(false);
      onDirty(false);
      notify('تم حفظ القالب');
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="template-layout">
      <div className="panel form-section">
        <div className="section-title">
          <h2>قوالبك</h2>
          <button
            className="icon-button"
            aria-label="قالب جديد"
            onClick={() => select(blankTemplate())}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="template-tabs">
          {data.templates.map((t) => (
            <button
              key={t.id}
              className={t.id === template.id ? 'selected' : ''}
              onClick={() => select(t)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <fieldset disabled={busy}>
          <label>
            اسم القالب
            <input
              aria-label="اسم القالب"
              placeholder="مثال: ورق الشركة الرسمي"
              value={template.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
          <div className="upload-controls">
            <button
              className="upload-button"
              onClick={() => void image('background')}
            >
              <ImagePlus size={22} />
              <strong>
                {template.background ? 'تغيير ورق الشركة' : 'رفع ورق الشركة'}
              </strong>
              <small>PNG أو JPG · حتى 8 MB</small>
            </button>
            {template.background && (
              <button
                className="text-button danger"
                onClick={() => update({ background: null })}
              >
                إزالة الخلفية
              </button>
            )}
            <button
              className="secondary full-width"
              onClick={() => void image('stamp')}
            >
              <ImagePlus size={17} />
              {template.stamp ? 'تغيير الختم' : 'إضافة ختم شفاف'}
            </button>
            {template.stamp && (
              <button
                className="text-button danger"
                onClick={() => update({ stamp: null })}
              >
                إزالة الختم
              </button>
            )}
          </div>
          <p className="field-help">
            يفضل ورق A4 بدقة 2480 × 3508 بكسل. اسحب الختم في المعاينة أو اضبط
            موضعه أدناه.
          </p>
          {(
            [
              {
                key: 'stampX',
                label: 'موضع الختم الأفقي',
                min: 0,
                max: 80,
                unit: '%',
              },
              {
                key: 'stampY',
                label: 'موضع الختم العمودي',
                min: 0,
                max: 85,
                unit: '%',
              },
              {
                key: 'stampWidth',
                label: 'عرض الختم',
                min: 5,
                max: 30,
                unit: '%',
              },
              {
                key: 'marginTop',
                label: 'مساحة الترويسة',
                min: 10,
                max: 70,
                unit: 'مم',
              },
              {
                key: 'marginBottom',
                label: 'مساحة التذييل',
                min: 10,
                max: 60,
                unit: 'مم',
              },
            ] as const
          ).map((control) => (
            <label className="range-label" key={control.key}>
              <span>
                {control.label}
                <b>
                  {Math.round(template[control.key])} {control.unit}
                </b>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                value={template[control.key]}
                onChange={(e) =>
                  update({ [control.key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          <button
            className="primary full-width"
            onClick={() => void save()}
            disabled={busy}
          >
            <Save size={16} />
            حفظ القالب
          </button>
        </fieldset>
      </div>
      <div className="template-preview-area">
        <div
          className="template-preview"
          onPointerMove={(event) => {
            if (
              event.buttons !== 1 ||
              !template.stamp ||
              !event.currentTarget.hasPointerCapture(event.pointerId)
            )
              return;
            const rect = event.currentTarget.getBoundingClientRect();
            update({
              stampX: Math.max(
                0,
                Math.min(
                  80,
                  ((event.clientX - rect.left) / rect.width) * 100 -
                    template.stampWidth / 2,
                ),
              ),
              stampY: Math.max(
                0,
                Math.min(
                  85,
                  ((event.clientY - rect.top) / rect.height) * 100 - 4,
                ),
              ),
            });
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        >
          {template.background && (
            <img
              className="template-background"
              src={template.background}
              alt="ورق الشركة"
            />
          )}
          <div
            className="template-content-guide"
            style={{
              top: `${(template.marginTop / 297) * 100}%`,
              bottom: `${(template.marginBottom / 297) * 100}%`,
            }}
          >
            <span>منطقة بيانات المستند</span>
            <div className="guide-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          {template.stamp && (
            <img
              draggable={false}
              className="draggable-stamp"
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.parentElement!.setPointerCapture(
                  event.pointerId,
                );
              }}
              src={template.stamp}
              alt="اسحب الختم لتغيير موضعه"
              style={{
                left: `${template.stampX}%`,
                top: `${template.stampY}%`,
                width: `${template.stampWidth}%`,
              }}
            />
          )}
          <span className="a4-label">A4 · 210 × 297 mm</span>
        </div>
        <p className="field-help">
          المعاينة للتوضيح. حدود الطباعة الفعلية تعتمد على الطابعة.
        </p>
      </div>
    </div>
  );
}
