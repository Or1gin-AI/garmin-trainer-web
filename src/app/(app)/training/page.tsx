'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  deleteTrainingPlan,
  listTrainingPlans,
  type PlanStatus,
  type TrainingPlanSummary,
} from '@/lib/api';
import {
  T, Btn, Card, SectionLabel, StatusBadge, PageHero, Banner,
  type StatusKind,
} from '@/components/track';
import { formatWeekStartShort, planShortId } from '@/lib/format';

const PLAN_LIMIT = 10;

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

function summaryPreview(s: string | null): string {
  if (!s) return '—';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  const knownTranslations: Record<string, string> = {
    '本周共安排4次训练日，包含1次高强度课（阈值跑）和1次长距离有氧跑（周日LSD）。当前疲劳状态为高风险，最新刺激为节奏跑，且7天负荷呈上升趋势。': 'Four training days are scheduled this week, including one high-intensity threshold workout and one long aerobic run on Sunday. Current fatigue risk is high, with the latest stimulus being a tempo run and the 7-day load trending upward.',
    '本周训练计划共4天，包含3次跑步（2次有氧跑、1次恢复跑）和4天休息，未安排长距离或质量课。当前疲劳正常，近期无可靠活动数据，本周以轻松有氧跑为主，帮助建立心肺基础。': 'Four training days are scheduled this week, including three runs (two aerobic runs and one recovery run) with four rest days. No long or quality workout is planned. Fatigue is normal, and the week emphasizes easy aerobic running to build an aerobic base.',
  };
  if (knownTranslations[trimmed]) return knownTranslations[trimmed];
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
}

export default function TrainingListPage() {
  const [plans, setPlans] = useState<TrainingPlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);

  useEffect(() => {
    listTrainingPlans()
      .then((r) =>
        setPlans(
          r.plans
            .slice()
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        ),
      )
      .catch((e) => setError((e as Error).message));
  }, []);

  const active = (plans ?? []).filter((p) => p.status !== 'archived');
  const archived = (plans ?? []).filter((p) => p.status === 'archived');
  const planCount = plans?.length ?? 0;
  const limitReached = plans !== null && planCount >= PLAN_LIMIT;

  async function handleDelete(plan: TrainingPlanSummary) {
    const ok = window.confirm(
      'Delete this local training plan? If it has been uploaded to Garmin, delete the remote copy from CN/International on the details page first.',
    );
    if (!ok) return;
    setDeletingPlanId(plan.id);
    setError(null);
    try {
      await deleteTrainingPlan(plan.id);
      setPlans((prev) => (prev ?? []).filter((p) => p.id !== plan.id));
    } catch (e) {
      const err = e as ApiError;
      const detail = err.detail as { error?: string; activeCount?: number } | undefined;
      setError(
        detail?.error === 'garmin_plan_uploaded'
          ? `This plan still has ${detail.activeCount ?? 0} Garmin remote copies. Delete them from Garmin on the details page before deleting the local plan.`
          : err.message,
      );
    } finally {
      setDeletingPlanId(null);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Training plans"
        title="Training Plans"
        sub={`AI-generated weekly plans based on your goals and Garmin history. ${planCount}/${PLAN_LIMIT} plans.`}
        actions={
          limitReached ? (
            <Btn disabled>Plan limit reached</Btn>
          ) : (
            <Link href="/training/new" style={{ textDecoration: 'none' }}>
              <Btn>+ New plan</Btn>
            </Link>
          )
        }
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      {limitReached && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="warn" code="LIMIT">You can keep at most {PLAN_LIMIT} training plans. Delete an old plan before creating another.</Banner>
        </div>
      )}

      {plans === null && !error && (
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
          // Loading…
        </div>
      )}

      {plans && plans.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginBottom: 8 }}>NO PLANS</div>
          <p style={{ color: T.inkDim, fontSize: 14, margin: '0 0 18px' }}>You have no training plans yet.</p>
          <Link href="/training/new" style={{ textDecoration: 'none' }}>
            <Btn>Create your first plan</Btn>
          </Link>
        </Card>
      )}

      {active.length > 0 && (
        <>
          <SectionLabel>Active plans</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {active.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                deleting={deletingPlanId === p.id}
                opening={openingPlanId === p.id}
                onOpen={() => setOpeningPlanId(p.id)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <SectionLabel>Archived</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {archived.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                archived
                deleting={deletingPlanId === p.id}
                opening={openingPlanId === p.id}
                onOpen={() => setOpeningPlanId(p.id)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PlanRow({
  plan,
  archived,
  deleting,
  opening,
  onOpen,
  onDelete,
}: {
  plan: TrainingPlanSummary;
  archived?: boolean;
  deleting: boolean;
  opening: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();

  function openPlan() {
    if (opening || deleting) return;
    onOpen();
    router.push(`/training/${plan.id}`);
  }

  return (
    <Card
      hover
      onClick={openPlan}
      style={{
        padding: 20,
        opacity: archived ? 0.55 : 1,
        cursor: opening || deleting ? 'wait' : 'pointer',
        borderColor: opening ? T.lime : undefined,
        boxShadow: opening ? `0 0 22px ${T.limeGlow}` : undefined,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', gap: 18, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, fontWeight: 600 }}>
              {planShortId(plan.id)}
            </span>
            {opening ? <StatusBadge kind="running" size="sm" /> : <StatusBadge kind={STATUS_MAP[plan.status]} size="sm" />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.ink }}>
            {formatWeekStartShort(plan.weekStartDate)}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: T.inkDim, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {opening ? 'Opening plan…' : summaryPreview(plan.summary)}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>CREATED</div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim }}>
            {new Date(plan.createdAt).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openPlan();
            }}
            disabled={opening || deleting}
          >
            {opening ? 'Opening…' : 'Details'}
          </Btn>
          <Btn
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting || opening}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
