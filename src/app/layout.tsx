import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Garmin Trainer',
  description: '把国区 Garmin 运动记录同步到国际区',
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
