import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'AV Watch | Autonomous Vehicle Accountability',
  description:
    'A transparent platform for reporting and tracking autonomous vehicle incidents. Empowering communities with data-driven accountability.',
  keywords: [
    'autonomous vehicles',
    'robotaxi',
    'waymo',
    'self-driving cars',
    'safety',
    'incident reporting',
  ],
  authors: [{ name: 'AV Watch Team' }],
  openGraph: {
    title: 'AV Watch | Autonomous Vehicle Accountability',
    description:
      'Report AV incidents and explore community-driven safety data',
    type: 'website',
    locale: 'en_US',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

