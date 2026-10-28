'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deleteTrainingPlanFromGarmin,
  getTrainingPlanGarminStatus,
  pushTrainingPlanToGarmin,
  type GarminPlanPublishStatus,
  type GarminRegion,
} from '@/lib/api';

export const GARMIN_REGIONS: Array<{ key: GarminRegion; label: string; name: string; code: string; host: string }> = [
  { key: 'cn', label: 'CN', name: 'Garmin China', code: 'CN', host: 'garmin.cn' },
  { key: 'global', label: 'International', name: 'Garmin International', code: 'INTL', host: 'garmin.com' },
];

function garminRegionName(region: GarminRegion): string {
  return GARMIN_REGIONS.find((r) => r.key === region)?.name ?? region;
}

function workoutCount(n: number): string {
  return `${n} ${n === 1 ? 'workout' : 'workouts'}`;
}

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
    const label = garminRegionName(region);
    setBusy('push');
    setNotice(null);
    setError(null);
    try {
      const result = await pushTrainingPlanToGarmin(planId, region);
      setStatus(result.status);
      setNotice(
        result.blockedByCleanup
          ? `Couldn’t remove ${workoutCount(result.failed)} from a previous upload to ${label}. Upload stopped to avoid duplicates.`
          : result.failed > 0
          ? `Uploaded ${workoutCount(result.pushed)} to ${label}. ${workoutCount(result.failed)} failed — you can retry.`
          : result.deletedBeforePush > 0
            ? `Replaced ${workoutCount(result.deletedBeforePush)} on ${label} and uploaded ${workoutCount(result.pushed)}.`
            : `Uploaded ${workoutCount(result.pushed)} to ${label}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!planId || busy) return;
    const label = garminRegionName(region);
    setBusy('delete');
    setNotice(null);
    setError(null);
    try {
      const result = await deleteTrainingPlanFromGarmin(planId, region);
      setStatus(result.status);
      setConfirmDelete(false);
      setNotice(
        result.failed > 0
          ? `Removed ${workoutCount(result.deleted)} from ${label}. ${workoutCount(result.failed)} failed — you can retry.`
          : `Removed ${workoutCount(result.deleted)} from ${label}.`,
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
