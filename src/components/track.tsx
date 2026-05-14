'use client';

// Track theme — dark precision-instrument style with cyber readouts.
// Ported from the Prototype.html handoff. Used across all pages.

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
  bg: '#0b0e0c',
  panel: 'rgba(17,21,18,0.4)',
  panelSolid: 'rgba(19,23,20,0.56)',
  panelRaised: '#181c19',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  borderHot: 'rgba(255,255,255,0.24)',
  ink: '#f3f5ef',
  inkDim: 'rgba(243,245,239,0.62)',
  inkFaint: 'rgba(243,245,239,0.38)',
  inkGhost: 'rgba(243,245,239,0.22)',
  lime: '#c6ff3a',
  limeDeep: '#a3dc15',
  limeGlow: 'rgba(198,255,58,0.18)',
  amber: '#ffaa1a',
  amberSoft: 'rgba(255,170,26,0.16)',
  red: '#ff5a4d',
  redSoft: 'rgba(255,90,77,0.14)',
  cyan: '#5fd8ff',
  cyanSoft: 'rgba(95,216,255,0.14)',
  green: '#9eff5a',
  sans: "'Noto Sans SC',Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  mono: "'SFMono-Regular','SF Mono',Consolas,'Liberation Mono',Menlo,monospace",
  pageMaxW: 1200,
} as const;

export type SportKind = 'running' | 'cycling' | 'swimming' | 'rest' | 'strength' | 'mobility';

export const SPORT: Record<SportKind, { code: string; label: string; color: string }> = {
  running: { code: 'RUN', label: '跑步', color: T.lime },
  cycling: { code: 'BIKE', label: '骑行', color: T.cyan },
  swimming: { code: 'SWIM', label: '游泳', color: T.cyan },
  rest: { code: '---', label: '休息', color: T.inkFaint },
  strength: { code: 'STR', label: '力量', color: T.amber },
  mobility: { code: 'MOB', label: '恢复', color: T.green },
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
        filter: `drop-shadow(0 0 ${Math.max(10, Math.round(size * 0.45))}px ${T.limeGlow})`,
        ...style,
      }}
    />
  );
}

export type IntensityKind = 'low' | 'medium' | 'high' | 'rest';

export const INTENSITY: Record<IntensityKind, { bars: number; code: string; label: string; color: string }> = {
  high: { bars: 3, code: 'HIGH', label: '高强度', color: T.red },
  medium: { bars: 2, code: 'MED', label: '中强度', color: T.amber },
  low: { bars: 1, code: 'LOW', label: '低强度', color: T.lime },
  rest: { bars: 0, code: 'REST', label: '休息', color: T.inkFaint },
};

export type StatusKind =
  | 'planned' | 'today' | 'completed' | 'skipped' | 'regenerating' | 'failed'
  | 'queued' | 'running' | 'success' | 'aborted'
  | 'generating' | 'ready' | 'archived';

export const STATUS: Record<StatusKind, { code: string; label: string; color: string; anim?: boolean; glow?: boolean; dim?: boolean }> = {
  planned: { code: 'PLANNED', label: '已计划', color: T.inkDim, dim: true },
  today: { code: 'TODAY', label: '今日', color: T.lime, glow: true },
  completed: { code: 'DONE', label: '已完成', color: T.green },
  skipped: { code: 'SKIP', label: '已跳过', color: T.amber },
  regenerating: { code: 'REGEN', label: '生成中', color: T.cyan, anim: true },
  failed: { code: 'FAIL', label: '失败', color: T.red },
  queued: { code: 'QUEUED', label: '排队中', color: T.cyan },
  running: { code: 'RUNNING', label: '运行中', color: T.lime, anim: true },
  success: { code: 'OK', label: '成功', color: T.green },
  aborted: { code: 'ABORT', label: '已中止', color: T.amber },
  generating: { code: 'GEN', label: '生成中', color: T.cyan, anim: true },
  ready: { code: 'READY', label: '就绪', color: T.green },
  archived: { code: 'ARCHIVED', label: '已归档', color: T.inkFaint, dim: true },
};

// ─── StatusBadge ────────────────────────────────────────────────

export function StatusBadge({ kind, size }: { kind: StatusKind; size?: 'sm' }) {
  const s = STATUS[kind] ?? STATUS.planned;
  const small = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '2px 7px' : '3px 9px',
      fontFamily: T.mono, fontSize: small ? 10 : 11,
      letterSpacing: 1.2, fontWeight: 600,
      color: s.color, background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${s.color}40`,
      borderRadius: 4, whiteSpace: 'nowrap',
      boxShadow: s.glow ? `0 0 12px ${s.color}30` : 'none',
    }}>
      <span style={{ opacity: 0.6 }}>[</span>
      <span className={s.anim ? 'track-blink' : ''}>{s.code}</span>
      <span style={{ opacity: 0.6 }}>]</span>
    </span>
  );
}

export function IntensityMeter({ kind, label }: { kind: IntensityKind; label?: boolean }) {
  const k = INTENSITY[kind] ?? INTENSITY.low;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 11, color: k.color, letterSpacing: 1 }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 4, height: 12, background: i < k.bars ? k.color : T.borderStrong,
            opacity: i < k.bars ? 1 : 0.4,
          }} />
        ))}
      </span>
      <span>{k.code}{label !== false ? <span style={{ color: T.inkFaint, marginLeft: 6 }}>· {k.label}</span> : null}</span>
    </span>
  );
}

export function SportTag({ kind, big }: { kind: SportKind; big?: boolean }) {
  const s = SPORT[kind] ?? SPORT.running;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 6,
      fontFamily: T.mono, fontSize: big ? 12 : 10,
      letterSpacing: 1.5, color: s.color, fontWeight: 600,
    }}>
      <span style={{ color: T.inkFaint }}>SPORT.</span>
      <span>{s.code}</span>
      <span style={{ color: T.inkFaint, fontFamily: T.sans, fontWeight: 400 }}>{s.label}</span>
    </span>
  );
}

export function WorkoutCodename({ code, name, size }: { code: string; name?: string | null; size?: 'sm' | 'lg' }) {
  const big = size !== 'sm';
  return (
    <div>
      <div style={{
        fontFamily: T.mono, fontSize: big ? 22 : 16, fontWeight: 700,
        color: T.lime, letterSpacing: -0.5, lineHeight: 1.1, wordBreak: 'break-all',
      }}>{code}</div>
      {name && (
        <div style={{ marginTop: big ? 4 : 2, fontSize: big ? 13 : 12, color: T.inkDim }}>{name}</div>
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
  let bg: string = T.lime, fg = '#0b0e0c';
  let shadow: string = 'none';
  if (ghost) { bg = 'transparent'; fg = T.ink; shadow = `inset 0 0 0 1px ${T.borderStrong}`; }
  if (danger) { bg = 'transparent'; fg = T.red; shadow = `inset 0 0 0 1px ${T.red}40`; }
  if (ok) { bg = `${T.green}18`; fg = T.green; shadow = `inset 0 0 0 1px ${T.green}40`; }
  return (
    <button
      type={type ?? 'button'}
      {...rest}
      style={{
        padding: small ? '6px 12px' : '9px 16px',
        borderRadius: 6, fontSize: small ? 11 : 13, fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        border: 'none', outline: 'none',
        boxShadow: shadow,
        background: bg, color: fg, fontFamily: T.sans, opacity: rest.disabled ? 0.4 : 1,
        transition: 'background .12s, transform .12s',
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
      background: T.panelSolid, borderRadius: 12,
      border: `1px solid ${hot ? T.lime : T.border}`,
      position: 'relative', overflow: 'hidden',
      boxShadow: glow ? `0 0 24px ${T.limeGlow}` : 'none',
      ...style,
    }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />}
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
        {eyebrow && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5, marginBottom: 4 }}>{eyebrow}</div>}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: T.ink }}>{title}</h2>
      </div>
      {right ?? (kind ? <StatusBadge kind={kind} /> : null)}
    </div>
  );
}

export function StatTile({
  label, value, unit, delta, tone, mono = true, accent,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  tone?: 'ok' | 'warn';
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div style={{
      background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, width: 36, height: 2, background: accent }} />}
      <div style={{ fontSize: 10, color: T.inkFaint, fontFamily: T.mono, letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: mono ? T.mono : T.sans,
          fontSize: 28, fontWeight: 600, letterSpacing: -1, color: T.ink, lineHeight: 1.1,
        }}>{value}</span>
        {unit && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1 }}>{unit}</span>}
      </div>
      {delta != null && (
        <div style={{
          position: 'absolute', top: 14, right: 14, fontFamily: T.mono, fontSize: 11,
          color: tone === 'ok' ? T.lime : tone === 'warn' ? T.amber : T.inkDim,
        }}>{delta}</div>
      )}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, letterSpacing: 1.5 }}>{children}</div>
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
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

export function Readout({ k, v, vColor }: { k: string; v: ReactNode; vColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 0', borderBottom: `1px dashed ${T.border}` }}>
      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.5, width: 110 }}>{k}</span>
      <span style={{ flex: 1, fontFamily: T.mono, fontSize: 13, color: vColor || T.ink, wordBreak: 'break-word' }}>{v}</span>
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
        {eyebrow && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginBottom: 8 }}>{eyebrow}</div>}
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.05, color: T.ink }}>{title}</h1>
        {sub && <p style={{ margin: '10px 0 0', color: T.inkDim, fontSize: 14, lineHeight: 1.6, maxWidth: 720 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>{actions}</div>}
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
    info: { color: T.cyan, bg: T.cyanSoft },
    warn: { color: T.amber, bg: T.amberSoft },
    error: { color: T.red, bg: T.redSoft },
    ok: { color: T.lime, bg: T.limeGlow },
  }[kind];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px', borderRadius: 8,
      background: palette.bg, border: `1px solid ${palette.color}30`,
      fontSize: 13, color: T.ink, lineHeight: 1.55,
    }}>
      <span style={{
        fontFamily: T.mono, fontSize: 10, color: palette.color, letterSpacing: 1.2,
        padding: '2px 6px', border: `1px solid ${palette.color}50`, borderRadius: 4,
        flexShrink: 0,
      }}>{code || kind.toUpperCase()}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
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
