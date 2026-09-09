import { Tafgeet } from 'tafgeet-arabic';
import type { Product } from './catalog';
const zero = {
  TRY: 'ليرة تركية',
  USD: 'دولار أمريكي',
  EUR: 'يورو',
  SAR: 'ريال سعودي',
  AED: 'درهم إماراتي',
};
export function amountInWords(
  minor: number,
  currency: Product['currency'],
): string {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error('مبلغ غير صالح للتفقيط');
  if (minor === 0) return 'صفر ' + zero[currency] + ' فقط لا غير';
  const cents = BigInt(minor);
  const fraction = String(cents % 100n).padStart(2, '0');
  if (cents < 100n) {
    // The library requires a positive whole part. Its fractional rendering is
    // independent: remove exactly the known one-unit prefix, preserving grammar.
    const unit = new Tafgeet('1', currency).parse().replace(/ فقط لا غير$/, '');
    const full = new Tafgeet('1.' + fraction, currency).parse();
    const prefix = unit + ' و';
    if (!full.startsWith(prefix)) throw new Error('تعذر تفقيط أجزاء العملة');
    return full.slice(prefix.length).trim();
  }
  return new Tafgeet(String(cents / 100n) + '.' + fraction, currency).parse();
}
