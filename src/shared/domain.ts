import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
const decimal = (places: number) =>
  z
    .string()
    .regex(
      new RegExp(`^\\d{1,9}(?:\\.\\d{1,${places}})?$`),
      'أدخل رقماً موجباً بدقة مناسبة',
    );
export const itemSchema = z.object({
  id: z.string().uuid(),
  name: text(300).min(1, 'اسم البند مطلوب'),
  description: text(1000),
  quantity: decimal(3).refine(
    (v) => Number(v) > 0 && Number(v) <= 1000000,
    'الكمية يجب أن تكون أكبر من صفر وألا تتجاوز مليوناً',
  ),
  unitPrice: decimal(2),
  taxPercent: decimal(2)
    .nullable()
    .refine((v) => v === null || Number(v) <= 100, 'الضريبة بين 0 و100'),
  discount: decimal(2).nullable(),
});
export const settingsSchema = z.object({
  companyName: text(200),
  address: text(500),
  phone: text(80),
  email: text(200),
  currency: z.enum(['TRY', 'USD', 'EUR', 'SAR', 'AED']),
  clientLabel: text(80).min(1),
});
const imageData = z
  .string()
  .max(12_000_000)
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
  .nullable();
export const templateSchema = z.object({
  id: z.string().uuid(),
  name: text(120).min(1),
  background: imageData,
  stamp: imageData,
  stampX: z.number().min(0).max(80),
  stampY: z.number().min(0).max(85),
  stampWidth: z.number().min(5).max(30),
  marginTop: z.number().min(10).max(70),
  marginBottom: z.number().min(10).max(60),
});
export const documentSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  typeId: text(80).min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      'تاريخ غير صالح',
    ),
  clientLabel: text(80).min(1),
  clientName: text(200).min(1, 'اسم العميل مطلوب'),
  items: z.array(itemSchema).min(1).max(200),
  noteTitle: text(150),
  noteBody: text(3000),
  footerNote: text(1000),
  customFields: z
    .array(z.object({ label: text(100), value: text(500) }))
    .max(20),
  templateId: z.string().uuid().nullable(),
  status: z.enum(['draft', 'final']),
});
export const typeSchema = z.object({
  id: text(80).regex(/^[a-z0-9-]+$/),
  name: text(80).min(1),
  prefix: z.string().regex(/^[A-Z0-9-]{1,12}$/),
});
export type Item = z.infer<typeof itemSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Template = z.infer<typeof templateSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type DocumentType = z.infer<typeof typeSchema>;
export type Totals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: { subtotal: number; discount: number; tax: number; total: number }[];
};
export type SavedDocument = DocumentInput & {
  number: string;
  typeName: string;
  currency: Settings['currency'];
  company: Settings;
  template: Template | null;
  totals: Totals;
  createdAt: string;
  updatedAt: string;
};
export type DocumentSummary = {
  id: string;
  number: string;
  clientName: string;
  date: string;
  typeName: string;
  typeId: string;
  status: 'draft' | 'final';
  total: number;
  currency: string;
};
export type Bootstrap = {
  settings: Settings;
  types: DocumentType[];
  templates: Template[];
  documents: DocumentSummary[];
};
export const defaultSettings: Settings = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  currency: 'TRY',
  clientLabel: 'السادة',
};
export const defaultTypes: DocumentType[] = [
  { id: 'invoice', name: 'فاتورة', prefix: 'INV' },
  { id: 'quote', name: 'عرض سعر', prefix: 'QUO' },
  { id: 'receipt', name: 'سند قبض', prefix: 'REC' },
  { id: 'delivery', name: 'محضر استلام', prefix: 'DEL' },
];
function scaled(value: string, precision: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) * 10n ** BigInt(precision) +
    BigInt(fraction.padEnd(precision, '0'))
  );
}
function safe(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('المبلغ يتجاوز الحد المسموح');
  return Number(value);
}
export function calculate(items: Item[]): Totals {
  const parsed = z.array(itemSchema).min(1).max(200).parse(items);
  const lines = parsed.map((item) => {
    const subtotal =
      (scaled(item.quantity, 3) * scaled(item.unitPrice, 2) + 500n) / 1000n;
    const discount = item.discount === null ? 0n : scaled(item.discount, 2);
    if (discount > subtotal)
      throw new Error('الخصم لا يمكن أن يتجاوز قيمة البند');
    const tax =
      item.taxPercent === null
        ? 0n
        : ((subtotal - discount) * scaled(item.taxPercent, 2) + 5000n) / 10000n;
    return {
      subtotal: safe(subtotal),
      discount: safe(discount),
      tax: safe(tax),
      total: safe(subtotal - discount + tax),
    };
  });
  const sum = (key: keyof (typeof lines)[number]) =>
    safe(lines.reduce((s, line) => s + BigInt(line[key]), 0n));
  return {
    lines,
    subtotal: sum('subtotal'),
    discount: sum('discount'),
    tax: sum('tax'),
    total: sum('total'),
  };
}
export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat('ar', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}
export function newItem(): Item {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
    taxPercent: null,
    discount: null,
  };
}
export function newDocument(
  settings: Settings,
  typeId = 'invoice',
): DocumentInput {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    id: crypto.randomUUID(),
    revision: 0,
    typeId,
    date,
    clientLabel: settings.clientLabel,
    clientName: '',
    items: [newItem()],
    noteTitle: '',
    noteBody: '',
    footerNote: '',
    customFields: [],
    templateId: null,
    status: 'draft',
  };
}
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues[0]?.message ?? 'بيانات غير صالحة';
  return error instanceof Error ? error.message : 'تعذر إتمام العملية';
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface DesktopApi {
  bootstrap(): Promise<Result<Bootstrap>>;
  getDocument(id: string): Promise<Result<SavedDocument>>;
  saveDocument(input: DocumentInput): Promise<Result<SavedDocument>>;
  saveSettings(input: Settings): Promise<Result<Settings>>;
  saveTemplate(input: Template): Promise<Result<Template>>;
  addType(input: DocumentType): Promise<Result<DocumentType>>;
  importImage(): Promise<Result<string | null>>;
  exportPdf(id: string): Promise<Result<boolean>>;
  printDocument(id: string): Promise<Result<boolean>>;
  backup(): Promise<Result<boolean>>;
}
declare global {
  interface Window {
    tesir?: DesktopApi;
  }
}
