import type { Result } from '../shared/domain';
export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const result = await request;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
export function api() {
  if (!window.tesir)
    throw new Error('افتح التطبيق عبر Electron للوصول إلى بياناتك المحلية');
  return window.tesir;
}
