'use client';

import { useEffect, useRef, useState } from 'react';
import { trainingPlanExportUrl } from '@/lib/api';
import { T, Btn, Card } from '@/components/track';
import { GARMIN_REGIONS, type useGarminPublish } from './useGarminPublish';

const EXPORT_FORMATS = [
  { key: 'intervals_icu', label: 'Intervals.icu' },
  { key: 'word', label: 'Word' },
  { key: 'pdf', label: 'PDF' },
  { key: 'excel', label: 'Excel' },
] as const;

export function ActionsMenu({
  planId,
  planReady,
  garmin,
  onDeletePlan,
}: {
  planId: string;
  planReady: boolean;
  garmin: ReturnType<typeof useGarminPublish>;
  onDeletePlan: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const uploaded = garmin.status?.uploaded ?? false;
  const failed = garmin.status?.failed ?? 0;
  const scheduled = garmin.status?.scheduled ?? 0;
  const regionMeta = GARMIN_REGIONS.find((r) => r.key === garmin.region) ?? GARMIN_REGIONS[0];

  const statusText = garmin.status
    ? uploaded
      ? failed > 0
        ? `${regionMeta.label}已上传 ${scheduled} 节，${failed} 节需处理`
        : `${regionMeta.label}已上传 ${scheduled} 节`
      : `${regionMeta.label}尚未上传`
    : '读取中…';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Btn variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        操作 {open ? '▴' : '▾'}
      </Btn>
      {open && (
        <Card style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 320, padding: 0, zIndex: 40,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.5, marginBottom: 10 }}>
              EXPORT
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EXPORT_FORMATS.map((f) => (
                <Btn key={f.key} variant="ghost" size="sm" onClick={() => {
                  window.location.href = trainingPlanExportUrl(planId, f.key);
                  setOpen(false);
                }}>
                  {f.label}
                </Btn>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{
              fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 8,
              color: uploaded ? T.cyan : T.lime,
            }}>
              GARMIN · {regionMeta.code}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {GARMIN_REGIONS.map((r) => (
                <Btn
                  key={r.key}
                  variant={garmin.region === r.key ? 'ok' : 'ghost'}
                  size="sm"
                  onClick={() => garmin.setRegion(r.key)}
                  disabled={garmin.busy !== null}
                >
                  {r.label}
                </Btn>
              ))}
            </div>
            <div style={{ fontSize: 12, color: T.inkDim, marginBottom: 8 }}>{statusText}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn size="sm" onClick={garmin.push} disabled={!planReady || garmin.busy !== null}>
                {garmin.busy === 'push' ? '上传中…' : uploaded ? '重新上传' : '上传'}
              </Btn>
              {uploaded && (
                <Btn variant="danger" size="sm" onClick={() => { garmin.setConfirmDelete(true); setOpen(false); }} disabled={garmin.busy !== null}>
                  删除远端
                </Btn>
              )}
            </div>
          </div>

          <div style={{ padding: '14px 16px' }}>
            <Btn variant="danger" size="sm" onClick={() => { onDeletePlan(); setOpen(false); }} style={{ width: '100%' }}>
              删除本地计划
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
