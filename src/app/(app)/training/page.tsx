'use client';

import Link from 'next/link';
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

const PLAN_LIMIT = 10;

const STATUS_MAP: Record<PlanStatus, StatusKind> = {
  generating: 'generating',
  ready: 'ready',
  failed: 'failed',
  archived: 'archived',
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatWeekStart(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[2])}月${Number(m[3])}日 · ${WEEKDAY_LABELS[date.getDay()]}`;
}

function summaryPreview(s: string | null): string {
  if (!s) return '—';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
}

function planShortId(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

export default function TrainingListPage() {
  const [plans, setPlans] = useState<TrainingPlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  useEffect(() => {
    listTrainingPlans()
      .then((r) => setPlans(r.plans))
      .catch((e) => setError((e as Error).message));
  }, []);

  const active = (plans ?? []).filter((p) => p.status !== 'archived');
  const archived = (plans ?? []).filter((p) => p.status === 'archived');
  const planCount = plans?.length ?? 0;
  const limitReached = plans !== null && planCount >= PLAN_LIMIT;

  async function handleDelete(plan: TrainingPlanSummary) {
    const ok = window.confirm(
      '确认删除这份本地训练计划？如果它已经上传到 Garmin，请先在详情页从国区/国际区 Garmin 删除远端副本。',
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
          ? `这份计划还有 ${detail.activeCount ?? 0} 条 Garmin 远端副本，请先到详情页从 Garmin 删除后再删本地计划。`
          : err.message,
      );
    } finally {
      setDeletingPlanId(null);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="// 训练计划"
        title="训练计划"
        sub={`AI 根据你的目标 + Garmin 历史数据生成的周计划。当前 ${planCount}/${PLAN_LIMIT} 份。`}
        actions={
          limitReached ? (
            <Btn disabled>已达 10 份上限</Btn>
          ) : (
            <Link href="/training/new" style={{ textDecoration: 'none' }}>
              <Btn>+ 新建计划</Btn>
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
          <Banner kind="warn" code="LIMIT">最多同时保留 {PLAN_LIMIT} 份训练计划。删除旧计划后可以继续新建。</Banner>
        </div>
      )}

      {plans === null && !error && (
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
          // 加载中…
        </div>
      )}

      {plans && plans.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginBottom: 8 }}>// 暂无计划</div>
          <p style={{ color: T.inkDim, fontSize: 14, margin: '0 0 18px' }}>你还没有训练计划。</p>
          <Link href="/training/new" style={{ textDecoration: 'none' }}>
            <Btn>新建第一个计划</Btn>
          </Link>
        </Card>
      )}

      {active.length > 0 && (
        <>
          <SectionLabel>进行中</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {active.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                deleting={deletingPlanId === p.id}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <SectionLabel>已归档</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {archived.map((p) => (
              <PlanRow
                key={p.id}
                plan={p}
                archived
                deleting={deletingPlanId === p.id}
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
  onDelete,
}: {
  plan: TrainingPlanSummary;
  archived?: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <Card hover style={{ padding: 20, opacity: archived ? 0.55 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', gap: 18, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, fontWeight: 600 }}>
              {planShortId(plan.id)}
            </span>
            <StatusBadge kind={STATUS_MAP[plan.status]} size="sm" />
          </div>
          <Link href={`/training/${plan.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.ink }}>
              {formatWeekStart(plan.weekStartDate)}
            </div>
          </Link>
          <div style={{ marginTop: 6, fontSize: 13, color: T.inkDim, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {summaryPreview(plan.summary)}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>创建于</div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim }}>
            {new Date(plan.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Link href={`/training/${plan.id}`} style={{ textDecoration: 'none' }}>
            <Btn variant="ghost" size="sm">详情</Btn>
          </Link>
          <Btn variant="danger" size="sm" onClick={onDelete} disabled={deleting}>
            {deleting ? '删除中…' : '删除'}
          </Btn>
        </div>
      </div>
    </Card>
  );
}
