import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://garmin-trainer.uk'),
  title: 'Garmin Trainer',
  description: '把国区 Garmin 运动记录同步到国际区',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Garmin Trainer',
    description: '把国区 Garmin 运动记录同步到国际区',
    images: [{ url: '/brand-icon.png', width: 512, height: 512, alt: 'Garmin Trainer' }],
  },
  twitter: {
    card: 'summary',
    title: 'Garmin Trainer',
    description: '把国区 Garmin 运动记录同步到国际区',
    images: ['/brand-icon.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
