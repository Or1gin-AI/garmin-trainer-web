'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listTrainingPlans,
  type PlanStatus,
  type TrainingPlanSummary,
} from '@/lib/api';
import {
  T, Btn, Card, SectionLabel, StatusBadge, PageHero, Banner,
  type StatusKind,
} from '@/components/track';

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

function planCode(id: string): string {
  return `PLAN.${id.slice(0, 4).toUpperCase()}`;
}

export default function TrainingListPage() {
  const [plans, setPlans] = useState<TrainingPlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTrainingPlans()
      .then((r) => setPlans(r.plans))
      .catch((e) => setError((e as Error).message));
  }, []);

  const active = (plans ?? []).filter((p) => p.status !== 'archived');
  const archived = (plans ?? []).filter((p) => p.status === 'archived');

  return (
    <>
      <PageHero
        eyebrow="// PLANS"
        title="训练计划"
        sub="AI 根据你的目标 + Garmin 历史数据生成的周计划。每条计划独立运行，可随时与 AI 教练对话调整。"
        actions={
          <Link href="/training/new" style={{ textDecoration: 'none' }}>
            <Btn>+ 新建计划</Btn>
          </Link>
        }
      />

      {error && (
        <div style={{ marginBottom: 20 }}>
          <Banner kind="error" code="ERR">{error}</Banner>
        </div>
      )}

      {plans === null && !error && (
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkFaint, letterSpacing: 1.5 }} className="track-blink">
          // LOADING…
        </div>
      )}

      {plans && plans.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, marginBottom: 8 }}>// EMPTY</div>
          <p style={{ color: T.inkDim, fontSize: 14, margin: '0 0 18px' }}>你还没有训练计划。</p>
          <Link href="/training/new" style={{ textDecoration: 'none' }}>
            <Btn>新建第一个计划</Btn>
          </Link>
        </Card>
      )}

      {active.length > 0 && (
        <>
          <SectionLabel>ACTIVE</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {active.map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <SectionLabel>ARCHIVED</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {archived.map((p) => (
              <PlanRow key={p.id} plan={p} archived />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PlanRow({ plan, archived }: { plan: TrainingPlanSummary; archived?: boolean }) {
  return (
    <Link href={`/training/${plan.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <Card hover style={{ padding: 20, opacity: archived ? 0.55 : 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', gap: 18, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.lime, letterSpacing: 1.5, fontWeight: 600 }}>
                {planCode(plan.id)}
              </span>
              <StatusBadge kind={STATUS_MAP[plan.status]} size="sm" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3, color: T.ink }}>
              {formatWeekStart(plan.weekStartDate)}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: T.inkDim, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {summaryPreview(plan.summary)}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.inkFaint, letterSpacing: 1.5, marginBottom: 6 }}>CREATED</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim }}>
              {new Date(plan.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <Btn variant="ghost" size="sm">详情 →</Btn>
        </div>
      </Card>
    </Link>
  );
}
