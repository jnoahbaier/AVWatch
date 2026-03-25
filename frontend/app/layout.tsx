import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';

const SITE_URL = 'https://www.avwatch.org';
const SITE_NAME = 'AVWatch';
const TITLE = 'AVWatch — Report Autonomous Vehicle Incidents';
const DESCRIPTION =
  'Witnessed a Waymo, Zoox, or Tesla robotaxi behave dangerously? Report it on AVWatch — a free, community-driven platform tracking AV safety incidents in real time. Built by UC Berkeley researchers.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'autonomous vehicles',
    'robotaxi',
    'waymo incident',
    'self-driving car accident',
    'AV safety',
    'incident reporting',
    'San Francisco',
    'Zoox',
    'Tesla FSD',
    'community reporting',
  ],
  authors: [{ name: 'AV Watch Team', url: SITE_URL }],
  creator: 'UC Berkeley School of Information',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AVWatch — Report autonomous vehicle incidents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
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
  // Inject analytics key at server-render time so it's available regardless
  // of whether the env var was set during the Next.js build step.
  // The client reads window.__PH_KEY instead of process.env.NEXT_PUBLIC_POSTHOG_KEY.
  const phKey = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased bg-[#f0f6ff]">
        {phKey && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__PH_KEY=${JSON.stringify(phKey)}`,
            }}
          />
        )}
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

