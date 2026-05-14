'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deleteTrainingPlanFromGarmin,
  getTrainingPlanGarminStatus,
  pushTrainingPlanToGarmin,
  type GarminPlanPublishStatus,
  type GarminRegion,
} from '@/lib/api';

export const GARMIN_REGIONS: Array<{ key: GarminRegion; label: string; code: string; host: string }> = [
  { key: 'cn', label: '国区', code: 'CN', host: 'garmin.cn' },
  { key: 'global', label: '国际区', code: 'INTL', host: 'garmin.com' },
];

export function garminRegionLabel(region: GarminRegion): string {
  return GARMIN_REGIONS.find((r) => r.key === region)?.label ?? region;
}

export function useGarminPublish(planId: string) {
  const [region, setRegion] = useState<GarminRegion>('cn');
  const [status, setStatus] = useState<GarminPlanPublishStatus | null>(null);
  const [busy, setBusy] = useState<'push' | 'delete' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!planId) return;
    const s = await getTrainingPlanGarminStatus(planId, region).catch(() => null);
    setStatus(s);
  }, [planId, region]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  useEffect(() => {
    setStatus(null);
    setNotice(null);
    setConfirmDelete(false);
  }, [region]);

  async function push() {
    if (!planId || busy) return;
    const label = garminRegionLabel(region);
    setBusy('push');
    setNotice(null);
    setError(null);
    try {
      const result = await pushTrainingPlanToGarmin(planId, region);
      setStatus(result.status);
      setNotice(
        result.blockedByCleanup
          ? `${label}旧副本有 ${result.failed} 节删除失败，已停止上传，避免重复堆积。`
          : result.failed > 0
          ? `已上传 ${result.pushed} 节到${label}，${result.failed} 节失败，可重试。`
          : result.deletedBeforePush > 0
            ? `已清理${label}旧副本 ${result.deletedBeforePush} 节，并重新上传 ${result.pushed} 节。`
            : `已上传 ${result.pushed} 节到${label} Garmin。`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!planId || busy) return;
    const label = garminRegionLabel(region);
    setBusy('delete');
    setNotice(null);
    setError(null);
    try {
      const result = await deleteTrainingPlanFromGarmin(planId, region);
      setStatus(result.status);
      setConfirmDelete(false);
      setNotice(
        result.failed > 0
          ? `已从${label}删除 ${result.deleted} 节，${result.failed} 节失败，可重试。`
          : `已从${label} Garmin 删除 ${result.deleted} 节。`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return {
    region, setRegion,
    status, busy, notice, error,
    confirmDelete, setConfirmDelete,
    push, remove, refreshStatus,
  };
}
