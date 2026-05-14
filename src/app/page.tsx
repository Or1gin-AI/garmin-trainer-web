import Link from 'next/link';
import { T, Btn, BrandIcon } from '@/components/track';

export default function Home() {
  return (
    <main className="track-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{
        width: '100%', maxWidth: 720, textAlign: 'center',
        background: T.panelSolid, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: '56px 40px',
        boxShadow: `0 0 48px ${T.limeGlow}`,
      }}>
        <BrandIcon size={64} style={{ margin: '0 auto 28px' }} />

        <div style={{
          display: 'inline-block', padding: '4px 10px',
          fontFamily: T.mono, fontSize: 10, color: T.lime, letterSpacing: 1.8,
          border: `1px solid ${T.lime}40`, borderRadius: 4, marginBottom: 24,
        }}>
          GARMIN_TRAINER · v1.0
        </div>

        <h1 style={{
          margin: 0, fontSize: 48, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.05, color: T.ink,
        }}>
          你的 AI 教练
          <br />
          已就位
        </h1>

        <p style={{
          margin: '20px auto 0', maxWidth: 480, color: T.inkDim, fontSize: 16, lineHeight: 1.65,
        }}>
          连接国区 + 国际区 Garmin · 自动同步活动 · AI 根据真实数据生成下一周训练。
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginTop: 36, flexWrap: 'wrap',
        }}>
          <Link href="/sign-up" style={{ textDecoration: 'none' }}>
            <Btn>注册账号 →</Btn>
          </Link>
          <Link href="/sign-in" style={{ textDecoration: 'none' }}>
            <Btn variant="ghost">登录</Btn>
          </Link>
        </div>

        <div style={{
          marginTop: 44, paddingTop: 24, borderTop: `1px solid ${T.border}`,
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16,
          fontFamily: T.mono, fontSize: 10, color: T.inkFaint, letterSpacing: 1.2, lineHeight: 1.7,
          textAlign: 'left',
        }}>
          <div>
            <div style={{ color: T.lime, marginBottom: 4 }}>SYNC</div>
            <div style={{ color: T.ink, fontFamily: T.sans, fontSize: 13, letterSpacing: 0 }}>
              每 2 小时自动同步双区活动
            </div>
          </div>
          <div>
            <div style={{ color: T.lime, marginBottom: 4 }}>AI.COACH</div>
            <div style={{ color: T.ink, fontFamily: T.sans, fontSize: 13, letterSpacing: 0 }}>
              对话式教练 · 按需调整训练
            </div>
          </div>
          <div>
            <div style={{ color: T.lime, marginBottom: 4 }}>DATA</div>
            <div style={{ color: T.ink, fontFamily: T.sans, fontSize: 13, letterSpacing: 0 }}>
              基于历史数据生成周计划
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
