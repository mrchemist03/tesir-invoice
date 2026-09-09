import { money, type SavedDocument } from './domain';
export function DocumentView({ document: doc }: { document: SavedDocument }) {
  const tax = doc.items.some((item) => item.taxPercent !== null);
  const discount = doc.items.some((item) => item.discount !== null);
  return (
    <article
      className="document-paper"
      dir="rtl"
      style={{
        paddingTop: `${doc.template?.marginTop ?? 20}mm`,
        paddingBottom: `${doc.template?.marginBottom ?? 20}mm`,
      }}
    >
      {doc.template?.background && (
        <img
          className="paper-background"
          src={doc.template.background}
          alt=""
        />
      )}
      <div className="paper-content">
        <header className="paper-header">
          <div>
            <h1>{doc.typeName}</h1>
            <span className="paper-number" dir="ltr">
              {doc.number}
            </span>
            {doc.status === 'draft' && (
              <span className="draft-label">مسودة</span>
            )}
          </div>
          <div className="company-block">
            <strong>{doc.company.companyName || 'اسم الشركة'}</strong>
            <p>{doc.company.address}</p>
            <p dir="ltr">{doc.company.phone}</p>
            <p dir="ltr">{doc.company.email}</p>
          </div>
        </header>
        <div className="paper-recipient">
          <div>
            <small>{doc.clientLabel}</small>
            <h2>{doc.clientName || 'اسم العميل'}</h2>
          </div>
          <div>
            <small>تاريخ المستند</small>
            <p dir="ltr">{doc.date}</p>
          </div>
        </div>
        {doc.customFields
          .filter((field) => field.value.trim())
          .map((field, i) => (
            <p className="paper-field" key={i}>
              <strong>{field.label}: </strong>
              {field.value}
            </p>
          ))}
        <table className="paper-table">
          <thead>
            <tr>
              <th>#</th>
              <th>البند / الوصف</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              {discount && <th>الخصم</th>}
              {tax && <th>الضريبة %</th>}
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{item.name}</strong>
                  {item.description && <p>{item.description}</p>}
                </td>
                <td>{item.quantity}</td>
                <td>
                  {money(
                    Math.round(Number(item.unitPrice) * 100),
                    doc.currency,
                  )}
                </td>
                {discount && (
                  <td>
                    {item.discount === null
                      ? '—'
                      : money(doc.totals.lines[i].discount, doc.currency)}
                  </td>
                )}
                {tax && <td>{item.taxPercent ?? '—'}</td>}
                <td>{money(doc.totals.lines[i].total, doc.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="paper-totals">
          <div>
            <span>المجموع الفرعي</span>
            <b>{money(doc.totals.subtotal, doc.currency)}</b>
          </div>
          {discount && (
            <div>
              <span>الخصم</span>
              <b>{money(doc.totals.discount, doc.currency)}</b>
            </div>
          )}
          {tax && (
            <div>
              <span>الضريبة</span>
              <b>{money(doc.totals.tax, doc.currency)}</b>
            </div>
          )}
          <div className="grand-total">
            <span>الإجمالي</span>
            <b>{money(doc.totals.total, doc.currency)}</b>
          </div>
        </div>
        {doc.showAmountInWords && doc.amountInWords && (
          <p className="paper-words">
            <strong>الإجمالي كتابةً: </strong>
            {doc.amountInWords}
          </p>
        )}
        {doc.noteBody && (
          <section className="paper-note">
            <strong>{doc.noteTitle || 'ملاحظات'}</strong>
            <p>{doc.noteBody}</p>
          </section>
        )}
        {doc.footerNote && <p className="paper-footer">{doc.footerNote}</p>}
      </div>
      {doc.template?.stamp && (
        <img
          className="paper-stamp"
          src={doc.template.stamp}
          alt="الختم"
          style={{
            left: `${doc.template.stampX}%`,
            top: `${doc.template.stampY}%`,
            width: `${doc.template.stampWidth}%`,
          }}
        />
      )}
    </article>
  );
}
export const documentStyles = `
.document-paper{position:relative;background:white;color:#182e37;width:210mm;min-height:297mm;padding:20mm 14mm;box-sizing:border-box;font:12px 'Segoe UI',Tahoma,sans-serif;line-height:1.7;overflow-wrap:anywhere;isolation:isolate}
.paper-words{padding:12px;background:#edf4f1;break-inside:avoid;line-height:1.9}.paper-background{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:-1}.paper-content{position:relative}.paper-stamp{position:absolute;max-height:40mm;object-fit:contain;pointer-events:none}.paper-header{display:flex;justify-content:space-between;gap:20px;margin-bottom:28px}.paper-header h1{font-size:30px;color:#176957;margin:0 0 8px}.paper-number{font-family:monospace;letter-spacing:1px}.draft-label{display:inline-block;margin:0 12px;padding:2px 8px;border:1px solid #c5cdd0;color:#66777f;border-radius:4px}.company-block{text-align:left;max-width:48%;white-space:pre-line}.company-block strong{font-size:17px}.company-block p{margin:2px 0}.paper-recipient{display:flex;justify-content:space-between;border-top:1px solid #dbe4e4;padding-top:18px;margin-bottom:24px}.paper-recipient small{color:#6c7a7b}.paper-recipient h2{font-size:17px;margin:4px 0}.paper-recipient p{margin:4px 0}.paper-field{margin:6px 0}.paper-table{width:100%;border-collapse:collapse;margin-top:18px;text-align:right;font-size:11px}.paper-table th{background:#edf4f1;padding:10px 6px;border-bottom:1px solid #bbcec8;font-weight:600}.paper-table td{padding:12px 6px;border-bottom:1px solid #e4eaea;vertical-align:top}.paper-table td p{margin:3px 0;color:#677777;white-space:pre-line}.paper-table th:nth-child(2){width:32%}.paper-table tr{break-inside:avoid}.paper-table thead{display:table-header-group}.paper-totals{width:48%;margin:24px auto 24px 0;break-inside:avoid}.paper-totals>div{display:flex;justify-content:space-between;gap:15px;padding:7px 0}.paper-totals .grand-total{border-top:2px solid #176957;color:#176957;font-size:17px;margin-top:5px;padding-top:13px}.paper-note{border-top:1px solid #dbe4e4;padding-top:15px;white-space:pre-line;break-inside:avoid}.paper-note p{margin-top:5px}.paper-footer{color:#758585;border-top:1px solid #e1e8e6;padding-top:15px;white-space:pre-line}
`;
