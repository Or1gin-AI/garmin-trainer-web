const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatWeekStart(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]} · ${Number(m[2])} ${WEEKDAYS[date.getDay()]}, ${Number(m[3])}`;
}

export function formatWeekStartShort(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${WEEKDAYS[date.getDay()]}, ${Number(m[2])} ${Number(m[3])}`;
}

export function planShortId(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`;
}
