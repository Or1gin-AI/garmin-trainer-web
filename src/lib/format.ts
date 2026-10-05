const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatWeekStart(d: string): string {
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return [WEEKDAYS[date.getDay()] + ',', MONTHS[Number(m[2]) - 1], Number(m[3]) + ',', m[1]].join(' ');
}

export function formatWeekStartShort(d: string): string {
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return [WEEKDAYS[date.getDay()] + ',', MONTHS[Number(m[2]) - 1], Number(m[3])].join(' ');
}

export function planShortId(id: string): string {
  return '#' + id.slice(0, 6).toUpperCase();
}
