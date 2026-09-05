import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpLeft,
  Check,
  FilePlus2,
  Files,
  LayoutDashboard,
  LayoutTemplate,
  Search,
  Settings2,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  type Bootstrap,
  type DocumentInput,
  type SavedDocument,
  newDocument,
  money,
  errorMessage,
  documentSchema,
} from '../shared/domain';
import { api, unwrap } from './api';
import { Editor } from './Editor';
import { SettingsPage, TemplatesPage } from './Settings';

type Page = 'dashboard' | 'documents' | 'editor' | 'settings' | 'templates';
export function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [document, setDocument] = useState<
    DocumentInput | SavedDocument | null
  >(null);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const notify = useCallback(
    (text: string, error = false) => setNotice({ text, error }),
    [],
  );
  const reload = useCallback(async () => {
    const loaded = await unwrap(api().bootstrap());
    setData(loaded);
  }, []);
  useEffect(() => {
    reload().catch((error) => notify(errorMessage(error), true));
  }, [reload, notify]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function canLeave() {
    return (
      !dirty || window.confirm('لديك تغييرات غير محفوظة. هل تريد تجاهلها؟')
    );
  }
  function navigate(next: Page) {
    if (canLeave()) {
      setPage(next);
      setDirty(false);
    }
  }
  function create(type = 'invoice') {
    if (!data || !canLeave()) return;
    setDocument(newDocument(data.settings, type));
    setDirty(false);
    setPage('editor');
  }
  async function open(id: string) {
    if (!canLeave()) return;
    try {
      setDocument(await unwrap(api().getDocument(id)));
      setDirty(false);
      setPage('editor');
    } catch (error) {
      notify(errorMessage(error), true);
    }
  }
  if (!data)
    return (
      <div className="loading">
        <div className="brand-mark">ت</div>
        <h1>تأثير</h1>
        <p>{notice?.text ?? 'جارٍ فتح مساحة عملك…'}</p>
        {notice && (
          <button
            onClick={() =>
              reload().catch((error) => notify(errorMessage(error), true))
            }
          >
            إعادة المحاولة
          </button>
        )}
      </div>
    );
  const visible = data.documents.filter(
    (doc) =>
      (filter === 'all' || doc.typeId === filter) &&
      (statusFilter === 'all' || doc.status === statusFilter) &&
      (!fromDate || doc.date >= fromDate) &&
      (!toDate || doc.date <= toDate) &&
      `${doc.clientName} ${doc.number}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const titles: Record<Page, string> = {
    dashboard: 'مساحة عملك، أكثر ترتيباً.',
    documents: 'كل مستنداتك في مكان واحد.',
    editor: 'تفاصيل واضحة. مستند احترافي.',
    settings: 'تأثير، على مقاس عملك.',
    templates: 'هوية شركتك في كل مستند.',
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('dashboard');
          }}
        >
          <div className="brand-mark">ت</div>
          <div>
            <strong>تأثير</strong>
            <small>TESIR INVOICE</small>
          </div>
        </a>
        <div className="workspace-label">مساحة العمل</div>
        <nav>
          {(
            [
              { id: 'dashboard', label: 'نظرة عامة', icon: LayoutDashboard },
              { id: 'documents', label: 'المستندات', icon: Files },
              {
                id: 'templates',
                label: 'قوالب المستندات',
                icon: LayoutTemplate,
              },
              { id: 'settings', label: 'الإعدادات', icon: Settings2 },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={
                page === item.id ||
                (page === 'editor' && item.id === 'documents')
                  ? 'nav-item active'
                  : 'nav-item'
              }
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === 'documents' && (
                <span className="nav-count">{data.documents.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span />
            يعمل دون اتصال
          </div>
          <p>
            بياناتك على جهازك.
            <br />
            ومساحة أكبر للتركيز على عملك.
          </p>
          <div className="profile">
            <div className="avatar">
              {data.settings.companyName.charAt(0) || 'ت'}
            </div>
            <div>
              <strong>{data.settings.companyName || 'مساحة عملي'}</strong>
              <small>نسخة تجريبية · 0.1.0</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            مساحة العمل <span>/</span>{' '}
            {page === 'dashboard'
              ? 'نظرة عامة'
              : page === 'editor'
                ? 'محرر المستند'
                : page === 'settings'
                  ? 'الإعدادات'
                  : page === 'templates'
                    ? 'القوالب'
                    : 'المستندات'}
          </div>
          <span className="top-date">
            {new Intl.DateTimeFormat('ar', { dateStyle: 'long' }).format(
              new Date(),
            )}
          </span>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === 'dashboard'
                  ? 'أهلاً بك في تأثير'
                  : 'ببساطة، أنجز أكثر'}
              </span>
              <h1>{titles[page]}</h1>
              <p>
                {page === 'dashboard'
                  ? 'أنشئ مستنداتك وتابع أعمالك من مساحة واحدة، بهدوء ووضوح.'
                  : page === 'documents'
                    ? 'ابحث، راجع، وأكمل من حيث توقفت.'
                    : page === 'templates'
                      ? 'أضف ورق الشركة والختم وحدد موضع المحتوى على صفحة A4.'
                      : page === 'settings'
                        ? 'المعلومات التي تظهر على مستنداتك وتفضيلات مساحة العمل.'
                        : 'احفظ مسودتك ثم اعتمد المستند عندما يصبح جاهزاً.'}
              </p>
            </div>
            {(page === 'dashboard' || page === 'documents') && (
              <button className="primary" onClick={() => create()}>
                <FilePlus2 size={18} />
                مستند جديد
              </button>
            )}
          </div>
          {(page === 'dashboard' || page === 'documents') && (
            <>
              {page === 'dashboard' && (
                <>
                  <div className="stats-grid">
                    <Stat
                      label="كل المستندات"
                      value={data.documents.length.toString()}
                      detail="سجل أعمالك في مكان واحد"
                      icon={<Files />}
                    />
                    <Stat
                      label="المستندات المعتمدة"
                      value={data.documents
                        .filter((d) => d.status === 'final')
                        .length.toString()}
                      detail="جاهزة للطباعة والمشاركة"
                      icon={<ShieldCheck />}
                    />
                    <Stat
                      label="مسودات قيد العمل"
                      value={data.documents
                        .filter((d) => d.status === 'draft')
                        .length.toString()}
                      detail="بانتظار لمستك الأخيرة"
                      icon={<FilePlus2 />}
                    />
                  </div>
                  <section className="quick-create">
                    <div>
                      <span className="eyebrow">ابدأ بخطوة</span>
                      <h2>ماذا تريد أن تنشئ اليوم؟</h2>
                    </div>
                    <div className="quick-actions">
                      {data.types.slice(0, 4).map((type) => (
                        <button key={type.id} onClick={() => create(type.id)}>
                          <FilePlus2 size={20} />
                          <span>{type.name}</span>
                          <ArrowUpLeft size={16} />
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
              <section className="panel documents-panel">
                <div className="section-title">
                  <div>
                    <h2>
                      {page === 'dashboard' ? 'آخر المستندات' : 'سجل المستندات'}
                    </h2>
                    <p>التفاصيل التي تحتاجها، دون تعقيد.</p>
                  </div>
                  <span className="count-label">{visible.length} مستند</span>
                </div>
                <div className="filters">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="البحث في المستندات"
                      placeholder="ابحث باسم العميل أو رقم المستند…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="نوع المستند للفلترة"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">كل الأنواع</option>
                    {data.types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="حالة المستند للفلترة"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">كل الحالات</option>
                    <option value="draft">مسودة</option>
                    <option value="final">معتمد</option>
                  </select>
                </div>
                {page === 'documents' && (
                  <div className="date-filters">
                    <label>
                      من تاريخ
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </label>
                    <label>
                      إلى تاريخ
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery('');
                        setFilter('all');
                        setStatusFilter('all');
                        setFromDate('');
                        setToDate('');
                      }}
                    >
                      مسح الفلاتر
                    </button>
                  </div>
                )}
                {visible.length ? (
                  <div className="table-scroll">
                    <table className="document-list">
                      <thead>
                        <tr>
                          <th>المستند</th>
                          <th>العميل</th>
                          <th>التاريخ</th>
                          <th>القيمة</th>
                          <th>الحالة</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible
                          .slice(0, page === 'dashboard' ? 6 : undefined)
                          .map((doc) => (
                            <tr key={doc.id}>
                              <td>
                                <div className="document-id">
                                  <div className="file-icon">
                                    <Files size={18} />
                                  </div>
                                  <div>
                                    <button
                                      className="link-button"
                                      onClick={() => void open(doc.id)}
                                      dir="ltr"
                                    >
                                      {doc.number}
                                    </button>
                                    <small>{doc.typeName}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{doc.clientName}</td>
                              <td dir="ltr">{doc.date}</td>
                              <td className="amount">
                                {money(doc.total, doc.currency)}
                              </td>
                              <td>
                                <span className={`status ${doc.status}`}>
                                  {doc.status === 'final' ? 'معتمد' : 'مسودة'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`فتح ${doc.number}`}
                                  onClick={() => void open(doc.id)}
                                >
                                  <ArrowUpLeft size={18} />
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
                      <Files size={32} />
                    </div>
                    <h3>
                      {data.documents.length
                        ? 'لا توجد نتائج مطابقة'
                        : 'هنا تبدأ قصة أعمالك'}
                    </h3>
                    <p>
                      {data.documents.length
                        ? 'جرّب تغيير البحث أو الفلاتر.'
                        : 'أنشئ أول مستند، وسنحفظ لك التفاصيل هنا.'}
                    </p>
                    {!data.documents.length && (
                      <button className="secondary" onClick={() => create()}>
                        إنشاء أول مستند <ArrowUpLeft size={16} />
                      </button>
                    )}
                  </div>
                )}
              </section>
              <div className="privacy-note">
                <ShieldCheck size={16} />
                الحفظ محلي على جهازك · نسخة احتياطية تلقائية عند إغلاق التطبيق
              </div>
            </>
          )}
          {page === 'editor' && document && (
            <Editor
              key={document.id}
              initial={document}
              data={data}
              onDirty={setDirty}
              notify={notify}
              onSaved={async (saved) => {
                setDocument(saved);
                await reload();
              }}
              onClone={(saved) => {
                setDocument({
                  ...documentSchema.parse(saved),
                  id: crypto.randomUUID(),
                  revision: 0,
                  status: 'draft',
                });
                setDirty(true);
              }}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              data={data}
              reload={reload}
              notify={notify}
              onDirty={setDirty}
            />
          )}
          {page === 'templates' && (
            <TemplatesPage
              data={data}
              reload={reload}
              notify={notify}
              onDirty={setDirty}
            />
          )}
        </div>
      </main>
      {notice && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <X size={19} /> : <Check size={19} />}
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="إغلاق التنبيه"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
