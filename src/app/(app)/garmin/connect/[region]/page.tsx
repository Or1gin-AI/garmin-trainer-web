'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const API_URL = process.env.NODE_ENV === 'production'
  ? ''
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const BIND_LIMIT_NOTICE = 'Each region can only be linked to one Garmin account every 7 days. Make sure this is your own account before signing in.';

type Tone = 'info' | 'warning' | 'danger' | 'success';
type SsoMessage = {
  status?: unknown;
  serviceTicket?: unknown;
  serviceUrl?: unknown;
  successDetails?: unknown;
  gauthInitHeight?: unknown;
  gauthHeight?: unknown;
  openLiteBox?: unknown;
  errorDetails?: unknown;
};

export default function GarminConnectPage() {
  const params = useParams<{ region: string }>();
  const router = useRouter();
  const region = (params.region === 'cn' ? 'cn' : params.region === 'global' ? 'global' : null) as
    | 'cn'
    | 'global'
    | null;

  const [status, setStatus] = useState('Loading Garmin sign-in form…');
  const [tone, setTone] = useState<Tone>('info');
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);

  const setStatusMessage = useCallback((message: string, t: Tone = 'info') => {
    setStatus(message);
    setTone(t);
  }, []);

  const invalidRegionError = !region ? 'Invalid region. Go back and choose a region.' : null;

  useEffect(() => {
    if (!region) return;
    const root = widgetRootRef.current;
    if (!root) return;

    const ssoOrigin = region === 'cn' ? 'https://sso.garmin.cn' : 'https://sso.garmin.com';
    const ssoEmbed = `${ssoOrigin}/sso/embed`;
    // Build the signin URL directly. We deliberately do NOT use gauth-widget.js
    // because its loadGAuth function defaults `service` to the parent URL when
    // redirectAfterAccountLoginUrl is unset, and Garmin's CAS whitelist rejects
    // non-Garmin service URLs. We need:
    //   service = sso.garmin.{cn,com}/sso/embed   (whitelisted; matches the
    //                                              login-url the @gooin/garmin-connect
    //                                              lib uses for OAuth1 exchange)
    //   consumeServiceTicket = false               (so the post-login flow goes
    //                                              through casEmbedSuccess.html's
    //                                              "send SUCCESS+serviceTicket"
    //                                              branch, NOT the
    //                                              "top.location.href = response_url"
    //                                              branch that would navigate our
    //                                              parent away)
    //   no redirectAfterAccountLoginUrl            (same reason: any non-empty
    //                                              redirectAfter* makes
    //                                              casEmbedSuccess.html navigate
    //                                              the parent away)
    //   source = parent URL                        (server uses this to set
    //                                              parent_url in the rendered
    //                                              templates so XD.postMessage
    //                                              targets us back)
    //   embedWidget = false                        (inline iframe; otherwise the
    //                                              login JS does
    //                                              document.location.href = ...)
    const ssoParams = new URLSearchParams({
      clientId: 'GarminConnect',
      consumeServiceTicket: 'false',
      locale: region === 'cn' ? 'zh_CN' : 'en_US',
      embedWidget: 'false',
      service: ssoEmbed,
      source: window.location.href,
    });
    const iframeSrc = `${ssoOrigin}/sso/signin?${ssoParams.toString()}`;

    // Drop any pre-existing iframe (HMR / region switch).
    root.replaceChildren();

    const iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.title = 'Garmin login';
    iframe.style.width = '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.height = '760px';
    iframe.style.border = '0';
    iframe.style.background = 'white';
    root.appendChild(iframe);

    const submitTicket = async (ticket: string, serviceUrl: string | null) => {
      if (submitted.current) return;
      submitted.current = true;
      setStatusMessage('Signed in. Linking your account…', 'success');
      try {
        const res = await fetch(`${API_URL}/api/garmin/callback/${region}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket, serviceUrl }),
        });
        let data: {
          ok?: boolean;
          error?: string;
          profile?: { fullName?: string; userName?: string };
        } = {};
        try {
          data = await res.json();
        } catch {}
        if (!res.ok || !data.ok) {
          throw new Error(
            data.error ||
              (res.status === 401
                ? 'Your session has expired. Please sign in again, then reconnect Garmin.'
                : 'Linking failed. Please try again.'),
          );
        }
        const name = data.profile?.fullName || data.profile?.userName || '';
        const url = new URL('/garmin', window.location.origin);
        url.searchParams.set('connected', region);
        url.searchParams.set('region', region);
        if (name) url.searchParams.set('name', name);
        router.replace(url.toString());
      } catch (e) {
        submitted.current = false;
        setError((e as Error).message);
      }
    };

    const messageListener = (event: MessageEvent) => {
      if (event.origin !== ssoOrigin) return;
      let parsed: SsoMessage | null = null;
      try {
        parsed = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as SsoMessage);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;

      if (typeof parsed.gauthInitHeight === 'number') {
        iframe.style.height = `${Number(parsed.gauthInitHeight) + 20}px`;
        setStatusMessage('Garmin sign-in form loaded. Sign in below.');
        return;
      }
      if (typeof parsed.gauthHeight === 'number') {
        iframe.style.height = `${Number(parsed.gauthHeight) + 20}px`;
        return;
      }
      if (parsed.openLiteBox) {
        setStatusMessage('Garmin needs an extra verification step. Continue below.', 'warning');
        return;
      }

      const status = typeof parsed.status === 'string' ? parsed.status : null;
      const ticket = typeof parsed.serviceTicket === 'string' ? parsed.serviceTicket : null;
      const serviceUrl =
        typeof parsed.serviceUrl === 'string' && parsed.serviceUrl ? parsed.serviceUrl : null;

      if (status === 'SUCCESS' && ticket) {
        submitTicket(ticket, serviceUrl);
        return;
      }
      if (status === 'SUCCESS' && !ticket) {
        // Should not happen with our config — the casEmbedSuccess.html
        // SUCCESS-without-ticket branch only fires when redirectAfter* is set,
        // and that path also does top.location.href which would have
        // navigated us away anyway.
        setStatusMessage('Garmin reported success but didn’t return a sign-in ticket. Refresh and try again.', 'danger');
        return;
      }
      if (status === 'FAIL') {
        setStatusMessage('Incorrect email or password. Please try again below.', 'danger');
        return;
      }
      if (status === 'ACCOUNT_LOCKED') {
        setStatusMessage('This Garmin account is temporarily locked. Please try again later.', 'danger');
        return;
      }
      if (status === 'ACCOUNT_DISABLED') {
        setStatusMessage('This Garmin account is unavailable. Check its status on the Garmin website.', 'danger');
        return;
      }
    };
    window.addEventListener('message', messageListener);

    return () => {
      window.removeEventListener('message', messageListener);
      iframe.remove();
    };
  }, [region, router, setStatusMessage]);

  const toneClass = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }[tone];

  const regionLabel = region === 'cn' ? 'Garmin China (garmin.cn)' : region === 'global' ? 'Garmin International (garmin.com)' : '';
  const displayError = invalidRegionError || error;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <Link href="/garmin" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold mt-2">Connect {regionLabel}</h1>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">
            The sign-in form below is served directly by Garmin from <span className="font-mono">sso.garmin.{region === 'cn' ? 'cn' : 'com'}</span>.
          </p>
          <p className="text-sm text-red-600 mt-1 font-medium leading-relaxed">
            Your Garmin password goes straight to <span className="font-mono">sso.garmin.{region === 'cn' ? 'cn' : 'com'}</span> and never touches our servers. We only receive a one-time sign-in ticket from Garmin, which we exchange for an OAuth token.
          </p>
        </header>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-800">
          {BIND_LIMIT_NOTICE}
        </div>

        {displayError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {displayError}
            <div className="mt-3">
              <Link href="/garmin" className="text-emerald-600 hover:underline">
                Go back and try again
              </Link>
            </div>
          </div>
        ) : (
          <div className={`rounded-xl border p-3 text-sm ${toneClass}`}>{status}</div>
        )}

        <div
          ref={widgetRootRef}
          id="gauth-widget"
          className="bg-white border border-zinc-200 rounded-2xl p-2 min-h-[640px]"
        />
      </div>
    </main>
  );
}
