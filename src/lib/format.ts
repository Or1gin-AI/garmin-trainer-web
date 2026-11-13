const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseYmd(d: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "Monday, Oct 26, 2026" */
export function formatWeekStart(d: string): string {
  const date = parseYmd(d);
  if (!date) return d;
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "Mon, Oct 26" */
export function formatWeekStartShort(d: string): string {
  const date = parseYmd(d);
  if (!date) return d;
  return `${WEEKDAYS[date.getDay()].slice(0, 3)}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** "Oct 26 – Nov 1, 2026" for the 7-day week starting at d. */
export function formatWeekRange(d: string): string {
  const start = parseYmd(d);
  if (!start) return d;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`;
  const right = sameMonth ? `${end.getDate()}` : `${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `${left} – ${right}, ${end.getFullYear()}`;
}

/** "Oct 26" */
export function formatMonthDay(d: string): string {
  const date = parseYmd(d);
  if (!date) return d;
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** Relationship between a plan week and today. */
export function weekRelation(d: string): 'current' | 'upcoming' | 'past' | null {
  const start = parseYmd(d);
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - start.getTime()) / 86400000);
  if (diff < 0) return 'upcoming';
  if (diff <= 6) return 'current';
  return 'past';
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function planShortId(id: string): string {
  return '#' + id.slice(0, 6).toUpperCase();
}

/**
 * Coach text sometimes carries internal tokens: template ids ("run.tempo.v1")
 * and zone variables ("HR.zone2"). Swap them for plain wording.
 */
export function humanizeCoachText(text: string): string {
  const id = String.raw`(run|bike|ride|cycle|cycling|swim|rest|strength|mobility)\.([a-z0-9_]+(?:\.[a-z0-9_]+)*)\.v\d+`;
  const plain = (_m: string, kind: string, name: string) => {
    const words = name.replace(/[._]+/g, ' ').replace(/\blsd\b/i, 'long').trim();
    const k = kind.toLowerCase();
    if (k === 'rest') return /full/i.test(words) ? 'rest day' : words;
    const noun = k === 'run' ? 'run' : k === 'swim' ? 'swim' : k === 'strength' || k === 'mobility' ? k : 'ride';
    return `${words} ${noun}`;
  };
  const zones: Record<string, string> = {
    zone2: 'Zone 2', aerobic: 'the aerobic zone', aerobiclow: 'the low aerobic zone', recovery: 'the recovery zone',
    'recovery.high': 'the top of the recovery zone', tempo: 'the tempo zone', threshold: 'threshold',
    vo2: 'the VO2max zone', vo2cap: 'the VO2max zone',
  };
  return text
    // debug references such as "(payload.metrics.hardDays)"
    .replace(/\s*\(\s*payload\.[\w.]+\s*\)/g, '')
    // "(run.tempo.v1)" or ", run.tempo.v1)" right after the session is already named
    .replace(new RegExp(String.raw`\s*[(（,，]\s*\x60?${id}\x60?\s*[)）]`, 'gi'), (m) => (/^\s*[,，]/.test(m) ? ')' : ''))
    .replace(new RegExp(String.raw`\x60?${id}\x60?`, 'gi'), plain)
    .replace(/\bHR\.([a-z0-9]+(?:\.high|\.low)?)\b/gi, (m, key: string) => zones[key.toLowerCase()] ?? zones[key.toLowerCase().replace(/\.(high|low)$/, '')] ?? m);
}
