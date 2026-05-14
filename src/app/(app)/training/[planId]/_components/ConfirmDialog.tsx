'use client';

import type { ReactNode } from 'react';
import { T, Btn, Card } from '@/components/track';

export function ConfirmDialog({
  eyebrow,
  title,
  description,
  confirmLabel = '确认',
  confirmVariant = 'primary',
  busy,
  onCancel,
  onConfirm,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <Card style={{ width: 'min(500px, 100%)', padding: 22, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}>
        <div style={{
          fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 6,
          color: confirmVariant === 'danger' ? T.red : T.lime,
        }}>
          {eyebrow}
        </div>
        <h2 style={{ margin: '0 0 10px', color: T.ink, fontSize: 20, fontWeight: 700 }}>{title}</h2>
        <div style={{ margin: '0 0 18px', color: T.inkDim, fontSize: 13, lineHeight: 1.7 }}>{description}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>取消</Btn>
          <Btn variant={confirmVariant} size="sm" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
