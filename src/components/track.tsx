'use client';

// Track theme — dark, athletic, data-forward. Shared tokens and primitives
// used across all pages.

import Image from 'next/image';
import {
  type CSSProperties,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react';

export const T = {
  bg: '#0a0d0b',
  panel: 'rgba(20,24,21,0.72)',
  panelSolid: '#121614',
  panelRaised: '#181d1a',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  borderHot: 'rgba(255,255,255,0.22)',
  ink: '#f3f5ef',
  inkDim: 'rgba(243,245,239,0.68)',
  inkFaint: 'rgba(243,245,239,0.44)',
  inkGhost: 'rgba(243,245,239,0.22)',
  lime: '#c6ff3a',
  limeDeep: '#a3dc15',
  limeGlow: 'rgba(198,255,58,0.14)',
  amber: '#ffb020',
  amberSoft: 'rgba(255,176,32,0.14)',
  red: '#ff5f52',
  redSoft: 'rgba(255,95,82,0.13)',
  cyan: '#5fd8ff',
  cyanSoft: 'rgba(95,216,255,0.12)',
  green: '#7ee787',
  violet: '#a78bfa',
  sans: "Inter,'SF Pro Text',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
  mono: "'SF Mono','SFMono-Regular',ui-monospace,'JetBrains Mono',Consolas,'Liberation Mono',Menlo,monospace",
  pageMaxW: 1240,
  radius: 14,
} as const;

/** Small uppercase label style used for eyebrows, table heads and stat labels. */
export const LABEL: CSSProperties = {
  fontFamily: T.sans,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: T.inkFaint,
};

export type SportKind = 'running' | 'cycling' | 'swimming' | 'rest' | 'strength' | 'mobility';

export const SPORT: Record<SportKind, { code: string; label: string; color: string; icon: string }> = {
  running: { code: 'RUN', label: 'Run', color: T.amber, icon: '🏃' },
  cycling: { code: 'BIKE', label: 'Ride', color: T.green, icon: '🚴' },
  swimming: { code: 'SWIM', label: 'Swim', color: T.cyan, icon: '🏊' },
  rest: { code: 'REST', label: 'Rest', color: T.inkFaint, icon: '☾' },
  strength: { code: 'STR', label: 'Strength', color: T.violet, icon: '🏋' },
  mobility: { code: 'MOB', label: 'Mobility', color: T.cyan, icon: '🧘' },
};

export function BrandIcon({ size = 44, style }: { size?: number; style?: CSSProperties }) {
  return (
    <Image
      src="/brand-icon.png"
      alt=""
      aria-hidden="true"
      unoptimized
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: 'block',
        objectFit: 'contain',
        filter: `drop-shadow(0 0 ${Math.max(8, Math.round(size * 0.35))}px ${T.limeGlow})`,
        ...style,
      }}
    />
  );
}

export type IntensityKind = 'low' | 'medium' | 'high' | 'rest';

export const INTENSITY: Record<IntensityKind, { bars: number; code: string; label: string; color: string }> = {
  high: { bars: 3, code: 'HARD', label: 'Hard', color: T.red },
  medium: { bars: 2, code: 'MODERATE', label: 'Moderate', color: T.amber },
  low: { bars: 1, code: 'EASY', label: 'Easy', color: T.lime },
  rest: { bars: 0, code: 'REST', label: 'Rest', color: T.inkFaint },
};

export type StatusKind =
  | 'planned' | 'today' | 'completed' | 'skipped' | 'regenerating' | 'failed'
  | 'queued' | 'running' | 'success' | 'aborted'
  | 'generating' | 'ready' | 'archived';

export const STATUS: Record<StatusKind, { code: string; label: string; color: string; anim?: boolean; glow?: boolean; dim?: boolean }> = {
  planned: { code: 'PLANNED', label: 'Planned', color: T.inkDim, dim: true },
  today: { code: 'TODAY', label: 'Today', color: T.lime, glow: true },
  completed: { code: 'DONE', label: 'Completed', color: T.green },
  skipped: { code: 'SKIPPED', label: 'Skipped', color: T.amber },
  regenerating: { code: 'UPDATING', label: 'Updating', color: T.cyan, anim: true },
  failed: { code: 'FAILED', label: 'Failed', color: T.red },
  queued: { code: 'QUEUED', label: 'Queued', color: T.cyan },
  running: { code: 'RUNNING', label: 'Running', color: T.lime, anim: true },
  success: { code: 'SUCCESS', label: 'Success', color: T.green },
  aborted: { code: 'ABORTED', label: 'Aborted', color: T.amber },
  generating: { code: 'GENERATING', label: 'Generating', color: T.cyan, anim: true },
  ready: { code: 'READY', label: 'Ready', color: T.green },
  archived: { code: 'ARCHIVED', label: 'Archived', color: T.inkFaint, dim: true },
};

// ─── Badges ─────────────────────────────────────────────────────

export function Pill({
  color, children, size, solid, style,
}: {
  color: string;
  children: ReactNode;
  size?: 'sm';
  solid?: boolean;
  style?: CSSProperties;
}) {
  const small = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '2px 8px' : '4px 10px',
      fontFamily: T.sans, fontSize: small ? 11 : 12, fontWeight: 600,
      lineHeight: 1.3,
      color: solid ? T.bg : color,
      background: solid ? color : `${color}1a`,
      border: `1px solid ${color}33`,
      borderRadius: 999, whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  );
}

export function StatusBadge({ kind, size }: { kind: StatusKind; size?: 'sm' }) {
  const s = STATUS[kind] ?? STATUS.planned;
  return (
    <Pill color={s.color} size={size} style={{ boxShadow: s.glow ? `0 0 14px ${s.color}30` : 'none' }}>
      <span
        className={s.anim ? 'track-blink' : ''}
        style={{ width: 6, height: 6, borderRadius: 999, background: s.color, flexShrink: 0 }}
      />
      {s.label}
    </Pill>
  );
}

export function TierBadge({
  tier,
  size = 'sm',
  style,
}: {
  tier: 'plus' | 'max';
  size?: 'sm' | 'md';
  style?: CSSProperties;
}) {
  const small = size === 'sm';
  const color = tier === 'max' ? T.lime : T.amber;
  const background = tier === 'max' ? T.limeGlow : T.amberSoft;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 999,
      border: `1px solid ${color}55`,
      background,
      color,
      fontFamily: T.sans,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {tier.toUpperCase()}
    </span>
  );
}

export function PlusBadge(props: { size?: 'sm' | 'md'; style?: CSSProperties }) {
  return <TierBadge tier="plus" {...props} />;
}

export function MaxBadge(props: { size?: 'sm' | 'md'; style?: CSSProperties }) {
  return <TierBadge tier="max" {...props} />;
}

export function IntensityMeter({ kind, label }: { kind: IntensityKind; label?: boolean }) {
  const k = INTENSITY[kind] ?? INTENSITY.low;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: k.color }}>
      <span style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 4, height: 6 + i * 3, borderRadius: 1,
            background: i < k.bars ? k.color : T.borderStrong,
          }} />
        ))}
      </span>
      <span>{k.label}{label ? <span style={{ color: T.inkFaint, fontWeight: 500 }}> intensity</span> : null}</span>
    </span>
  );
}

export function SportTag({ kind, big }: { kind: SportKind; big?: boolean }) {
  const s = SPORT[kind] ?? SPORT.running;
  return (
    <Pill color={s.color} size={big ? undefined : 'sm'}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
      {s.label}
    </Pill>
  );
}

export function WorkoutCodename({ code, name, size }: { code: string; name?: string | null; size?: 'sm' | 'lg' }) {
  const big = size !== 'sm';
  return (
    <div>
      <div style={{
        fontFamily: T.sans, fontSize: big ? 22 : 17, fontWeight: 700,
        color: T.ink, letterSpacing: '-0.01em', lineHeight: 1.2,
      }}>{name || code}</div>
      {name && code && code !== name && (
        <div style={{ marginTop: 3, fontFamily: T.mono, fontSize: 11, color: T.inkFaint }}>{code}</div>
      )}
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────

type BtnProps = {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger' | 'ok';
  size?: 'sm';
  style?: CSSProperties;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Btn({ children, variant = 'primary', size, style, type, ...rest }: BtnProps) {
  const ghost = variant === 'ghost';
  const danger = variant === 'danger';
  const ok = variant === 'ok';
  const small = size === 'sm';
  let bg: string = T.lime, fg = '#0a0d0b';
  let shadow: string = `0 1px 0 rgba(255,255,255,0.25) inset, 0 6px 18px ${T.limeGlow}`;
  if (ghost) { bg = 'rgba(255,255,255,0.03)'; fg = T.ink; shadow = `inset 0 0 0 1px ${T.borderStrong}`; }
  if (danger) { bg = 'transparent'; fg = T.red; shadow = `inset 0 0 0 1px ${T.red}45`; }
  if (ok) { bg = `${T.lime}14`; fg = T.lime; shadow = `inset 0 0 0 1px ${T.lime}45`; }
  return (
    <button
      type={type ?? 'button'}
      {...rest}
      className={`track-btn ${rest.className ?? ''}`.trim()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: small ? '6px 12px' : '10px 18px',
        borderRadius: small ? 8 : 10, fontSize: small ? 12 : 14, fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        border: 'none', outline: 'none',
        boxShadow: rest.disabled ? 'none' : shadow,
        background: bg, color: fg, fontFamily: T.sans, opacity: rest.disabled ? 0.4 : 1,
        transition: 'background .12s, transform .12s, filter .12s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >{children}</button>
  );
}

// ─── Surfaces ────────────────────────────────────────────────────

export function Card({
  children, style, hot, hover, onClick, accent, glow,
}: {
  children: ReactNode;
  style?: CSSProperties;
  hot?: boolean;
  hover?: boolean;
  onClick?: () => void;
  accent?: string | null;
  glow?: boolean;
}) {
  return (
    <div onClick={onClick} className={hover ? 'track-card-hover' : ''} style={{
      background: T.panelSolid, borderRadius: T.radius,
      border: `1px solid ${hot ? `${T.lime}88` : T.border}`,
      position: 'relative', overflow: 'hidden',
      boxShadow: glow ? `0 0 0 1px ${T.lime}30, 0 10px 40px ${T.limeGlow}` : '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 32px rgba(0,0,0,0.25)',
      ...style,
    }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />}
      {children}
    </div>
  );
}

export function CardHeader({
  eyebrow, title, right, kind,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  right?: ReactNode;
  kind?: StatusKind;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        {eyebrow && <div style={{ ...LABEL, color: T.lime, marginBottom: 6 }}>{eyebrow}</div>}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: T.ink }}>{title}</h2>
      </div>
      {right ?? (kind ? <StatusBadge kind={kind} /> : null)}
    </div>
  );
}

export function StatTile({
  label, value, unit, delta, tone, mono = true, accent, hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  tone?: 'ok' | 'warn';
  mono?: boolean;
  accent?: string;
  hint?: ReactNode;
}) {
  return (
    <div style={{
      background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '16px 18px', position: 'relative', overflow: 'hidden',
    }}>
      {accent && <div style={{ position: 'absolute', top: 16, left: 0, width: 3, height: 18, borderRadius: 2, background: accent }} />}
      <div style={{ ...LABEL, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: T.sans, fontVariantNumeric: mono ? 'tabular-nums' : undefined,
          fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink, lineHeight: 1,
        }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: T.inkFaint, fontWeight: 500 }}>{unit}</span>}
      </div>
      {hint && <div style={{ marginTop: 8, fontSize: 12, color: T.inkFaint }}>{hint}</div>}
      {delta != null && (
        <div style={{
          position: 'absolute', top: 14, right: 16, fontSize: 12, fontWeight: 600,
          color: tone === 'ok' ? T.lime : tone === 'warn' ? T.amber : T.inkDim,
        }}>{delta}</div>
      )}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
      <div style={LABEL}>{children}</div>
      {right}
    </div>
  );
}

export function Field({
  label, hint, children, full,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: 'block', gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.inkDim, marginBottom: 7 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </label>
  );
}

export function Readout({ k, v, vColor }: { k: string; v: ReactNode; vColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.inkFaint, width: 120, flexShrink: 0 }}>{k}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: vColor || T.ink, wordBreak: 'break-word', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

export function PageHero({
  eyebrow, title, sub, actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        {eyebrow && <div style={{ ...LABEL, color: T.lime, marginBottom: 10 }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 750, letterSpacing: '-0.025em', lineHeight: 1.1, color: T.ink }}>{title}</h1>
        {sub && <p style={{ margin: '10px 0 0', color: T.inkDim, fontSize: 15, lineHeight: 1.6, maxWidth: 720 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

export function Banner({
  kind = 'info', children, code,
}: {
  kind?: 'info' | 'warn' | 'error' | 'ok';
  children: ReactNode;
  code?: string;
}) {
  const palette = {
    info: { color: T.cyan, bg: T.cyanSoft, icon: 'i' },
    warn: { color: T.amber, bg: T.amberSoft, icon: '!' },
    error: { color: T.red, bg: T.redSoft, icon: '!' },
    ok: { color: T.lime, bg: T.limeGlow, icon: '✓' },
  }[kind];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', borderRadius: 12,
      background: palette.bg, border: `1px solid ${palette.color}30`,
      fontSize: 14, color: T.ink, lineHeight: 1.55,
    }}>
      <span aria-hidden="true" style={{
        width: 20, height: 20, borderRadius: 999, flexShrink: 0, marginTop: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: palette.color, color: T.bg, fontSize: 12, fontWeight: 800,
      }}>{palette.icon}</span>
      <span style={{ flex: 1 }}>
        {code && <span style={{ fontWeight: 700, color: palette.color, marginRight: 8 }}>{bannerTitle(code)}</span>}
        {children}
      </span>
    </div>
  );
}

/** Banner codes used to be terse machine tags ("ERR", "GARMIN"); render them as friendly titles. */
function bannerTitle(code: string): string {
  const map: Record<string, string> = {
    ERR: 'Error',
    ERROR: 'Error',
    WARN: 'Heads up',
    INFO: 'Note',
    OK: 'Done',
    LIMIT: 'Limit reached',
  };
  if (map[code.toUpperCase()]) return map[code.toUpperCase()];
  if (/^[A-Z0-9_.-]+$/.test(code) && code.length > 3) return code.charAt(0) + code.slice(1).toLowerCase().replace(/[_.-]+/g, ' ');
  return code;
}

// ─── Inputs (with .track-input className for the focus ring) ───

export function TrackInput(props: InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const { mono, className, ...rest } = props;
  return <input {...rest} className={`track-input${mono ? ' track-input-mono' : ''} ${className ?? ''}`.trim()} />;
}

export function TrackTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, style, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`track-input ${className ?? ''}`.trim()}
      style={{ resize: 'vertical', minHeight: 60, ...style }}
    />
  );
}

export function TrackSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, style, ...rest } = props;
  return (
    <select
      {...rest}
      className={`track-input ${className ?? ''}`.trim()}
      style={{ appearance: 'none', backgroundImage: `linear-gradient(45deg, transparent 50%, ${T.inkFaint} 50%), linear-gradient(135deg, ${T.inkFaint} 50%, transparent 50%)`, backgroundPosition: `calc(100% - 16px) center, calc(100% - 12px) center`, backgroundSize: `4px 4px, 4px 4px`, backgroundRepeat: 'no-repeat', paddingRight: 28, ...style }}
    />
  );
}
