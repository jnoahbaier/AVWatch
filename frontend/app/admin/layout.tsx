import type { Metadata } from 'next';
import { SessionProvider } from './session-provider';

export const metadata: Metadata = {
  title: 'AVWatch Admin',
  robots: { index: false, follow: false }, // Don't index admin pages
};

/**
 * Admin layout intentionally omits the public Navbar.
 * Sessions are provided by SessionProvider (client component wrapper).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen font-sans antialiased bg-slate-950 text-slate-100">
      <SessionProvider>{children}</SessionProvider>
    </div>
  );
}
