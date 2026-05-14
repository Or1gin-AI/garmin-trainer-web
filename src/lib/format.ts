const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatWeekStart(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]} · ${Number(m[2])}月${Number(m[3])}日 ${WEEKDAYS[date.getDay()]}`;
}

export function formatWeekStartShort(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}月${Number(m[3])}日 · ${WEEKDAYS[date.getDay()]}`;
}

export function planShortId(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`;
}
