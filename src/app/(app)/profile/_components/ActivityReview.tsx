'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  generateActivityReview,
  getCachedActivityReview,
  type ActivityReviewHighlight,
  type ActivityReviewResponse,
  type ActivityReviewRuleResult,
  type ActivityReviewSeverity,
} from '@/lib/api';
import { Btn, T } from '@/components/track';

const SEVERITY_LABEL: Record<ActivityReviewSeverity, string> = {
  high: 'Needs attention',
  medium: 'Adjustment suggested',
  low: 'Can improve',
  opportunity: 'Opportunity',
};

function severityColor(s: ActivityReviewSeverity): string {
  if (s === 'high') return T.red;
  if (s === 'medium') return T.amber;
  if (s === 'opportunity') return T.lime;
  return T.cyan;
}

export function ActivityReview({
  region,
  activityId,
}: {
  region: string;
  activityId: string;
}) {
  const [review, setReview] = useState<ActivityReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCachedActivityReview(region, activityId)
      .then((r) => {
        if (!cancelled) setReview(r);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [region, activityId]);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await generateActivityReview(region, activityId);
      setReview(r);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError('AI review is a Max membership feature.');
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: T.inkFaint, fontFamily: T.mono }}>
        REVIEW.LOADING…
      </div>
    );
  }

  if (!review) {
    return (
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={onGenerate} disabled={generating} size="sm">
          {generating ? 'REVIEW.GENERATING…' : 'Generate AI review'}
        </Btn>
        {error && (
          <span style={{ fontSize: 12, color: T.red, fontFamily: T.mono }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.4 }}>
          AI.SUMMARY
        </span>
        {review.cached && (
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkGhost }}>CACHED</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn
            variant="ghost"
            size="sm"
            onClick={onGenerate}
            disabled={generating}
            aria-label="Regenerate"
          >
            {generating ? '…' : '↻'}
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => setShowRaw((v) => !v)}
          >
            {showRaw ? 'Hide data' : 'Raw data'}
          </Btn>
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: T.ink }}>
        {review.summary}
      </p>

      {review.highlights.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: T.inkDim }}>
          No rule-based recommendations for this activity.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {review.highlights.map((h) => (
            <HighlightCard key={h.ruleId} h={h} />
          ))}
        </div>
      )}

      {showRaw && <RawTable rules={review.ruleResults} />}

      {error && (
        <span style={{ fontSize: 12, color: T.red, fontFamily: T.mono }}>{error}</span>
      )}
    </div>
  );
}

function HighlightCard({ h }: { h: ActivityReviewHighlight }) {
  const color = severityColor(h.severity);
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        paddingLeft: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: 1.2,
            color,
          }}
        >
          {SEVERITY_LABEL[h.severity].toUpperCase()}
        </span>
        <span style={{ fontWeight: 600, fontSize: 13, color: T.ink }}>{h.title}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: T.inkDim }}>{h.body}</p>
      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.inkGhost }}>
        ref: {h.citation}
      </span>
    </div>
  );
}

function RawTable({ rules }: { rules: ActivityReviewRuleResult[] }) {
  if (rules.length === 0) {
    return (
      <div style={{ fontSize: 12, color: T.inkFaint, fontFamily: T.mono }}>
        RAW.EMPTY
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 4,
        padding: 10,
        background: T.panelSolid,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        overflowX: 'auto',
      }}
    >
      <pre
        style={{
          margin: 0,
          fontSize: 11,
          fontFamily: T.mono,
          color: T.inkDim,
          whiteSpace: 'pre-wrap',
        }}
      >
        {JSON.stringify(rules, null, 2)}
      </pre>
    </div>
  );
}
