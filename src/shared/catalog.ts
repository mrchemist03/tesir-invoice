import { z } from 'zod';
export const currencySchema = z.enum(['TRY', 'USD', 'EUR', 'SAR', 'AED']);
const name = (max: number, label: string) =>
  z.string().trim().min(1, `أدخل ${label}`).max(max, `${label} طويل جداً`);
const optionalText = (max: number) =>
  z.string().trim().max(max, 'النص يتجاوز الحد المسموح');
const price = z
  .string()
  .regex(
    /^\d{1,9}(?:\.\d{1,2})?$/,
    'أدخل سعراً موجباً أو صفراً، بمنزلتين عشريتين كحد أقصى',
  );
export const customerSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  name: name(200, 'اسم العميل'),
  phone: optionalText(80),
  email: optionalText(200),
  address: optionalText(500),
  taxNumber: optionalText(100),
  notes: optionalText(1000),
  archived: z.boolean(),
});
export const productSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  name: name(300, 'اسم المنتج'),
  sku: optionalText(80),
  description: optionalText(1000),
  unitPrice: price,
  currency: currencySchema,
  taxPercent: price
    .nullable()
    .refine((v) => v === null || Number(v) <= 100, 'الضريبة بين 0 و100'),
  archived: z.boolean(),
});
export type Customer = z.infer<typeof customerSchema>;
export type Product = z.infer<typeof productSchema>;
// Preserve distinct Arabic letters; only normalize presentation, spaces and case.
export function catalogKey(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}
export function blankCustomer(): Customer {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    name: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    notes: '',
    archived: false,
  };
}
export function blankProduct(currency: Product['currency']): Product {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    name: '',
    sku: '',
    description: '',
    unitPrice: '0',
    currency,
    taxPercent: null,
    archived: false,
  };
}
