import { calculate, type Item } from './domain';
export type DocumentImportPreview = {
  filename: string;
  rows: { row: number; name: string; item?: Item; error: string | null }[];
};
export function mergeImportedItems(
  current: Item[],
  incoming: Item[],
  replace: boolean,
): Item[] {
  const isPlaceholder =
    current.length === 1 &&
    !current[0].name &&
    !current[0].description &&
    current[0].quantity === '1' &&
    current[0].unitPrice === '0' &&
    current[0].taxPercent === null &&
    current[0].discount === null &&
    !current[0].productId;
  const items = [
    ...(replace || isPlaceholder ? [] : current),
    ...incoming.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      productId: null,
    })),
  ];
  if (items.length > 200)
    throw new Error(
      'الحد الأقصى للمستند 200 بند؛ اختر استبدال البنود أو قلّل عدد الصفوف',
    );
  calculate(items);
  return items;
}
