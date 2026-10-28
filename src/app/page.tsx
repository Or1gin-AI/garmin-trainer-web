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
          Your AI coach
          <br />
          is ready
        </h1>

        <p style={{
          margin: '20px auto 0', maxWidth: 480, color: T.inkDim, fontSize: 16, lineHeight: 1.65,
        }}>
          Connect Garmin China and Garmin International, sync activities automatically, and let AI build next week’s training from your real data.
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginTop: 36, flexWrap: 'wrap',
        }}>
          <Link href="/sign-up" style={{ textDecoration: 'none' }}>
            <Btn>Create account →</Btn>
          </Link>
          <Link href="/sign-in" style={{ textDecoration: 'none' }}>
            <Btn variant="ghost">Sign in</Btn>
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
              Both regions sync automatically every 2 hours
            </div>
          </div>
          <div>
            <div style={{ color: T.lime, marginBottom: 4 }}>AI Coach</div>
            <div style={{ color: T.ink, fontFamily: T.sans, fontSize: 13, letterSpacing: 0 }}>
              Chat with your coach · adjust training anytime
            </div>
          </div>
          <div>
            <div style={{ color: T.lime, marginBottom: 4 }}>DATA</div>
            <div style={{ color: T.ink, fontFamily: T.sans, fontSize: 13, letterSpacing: 0 }}>
              Weekly plans built from your history
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
