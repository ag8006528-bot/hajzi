/**
 * Where to send a customer after login/sign-up (the `?next=` parameter).
 * Only same-site field pages are allowed, so the parameter can't be abused as an open redirect
 * (e.g. ?next=https://evil.example or ?next=//evil.example).
 */
const ALLOWED = /^\/fields\/[a-z0-9-]{1,80}(\?(date=\d{4}-\d{2}-\d{2})(&time=\d{2}:\d{2})?)?$/;

export function safeNext(next: string | string[] | null | undefined, fallback = '/account'): string {
  const v = Array.isArray(next) ? next[0] : next;
  return v && v.length <= 200 && ALLOWED.test(v) ? v : fallback;
}
