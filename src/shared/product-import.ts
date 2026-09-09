import type { Product } from './catalog';
export type ImportRow = {
  row: number;
  name: string;
  product?: Product;
  status: 'new' | 'duplicate' | 'error';
  message: string;
};
export type ImportPreview = { filename: string; rows: ImportRow[] };
export const productHeaders = [
  'اسم المنتج',
  'رمز المنتج',
  'الوصف',
  'سعر الوحدة',
  'العملة',
  'الضريبة %',
];
