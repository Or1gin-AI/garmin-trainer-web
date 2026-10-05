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
  { key: 'cn', label: 'CN', code: 'CN', host: 'garmin.cn' },
  { key: 'global', label: 'International', code: 'INTL', host: 'garmin.com' },
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
          ? `${label}old has ${result.failed} DeleteFailed，Upload，。`
          : result.failed > 0
          ? `Uploaded ${result.pushed} workouts to${label}，${result.failed} workout failed and can be retried.`
          : result.deletedBeforePush > 0
            ? `${label}old  ${result.deletedBeforePush} workout,Upload again ${result.pushed} workout.`
            : `Uploaded ${result.pushed} workouts to${label} Garmin。`,
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
          ? `Removed from${label}Delete ${result.deleted} workout,${result.failed} workout failed and can be retried.`
          : `Removed from${label} Garmin Delete ${result.deleted} workout.`,
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
