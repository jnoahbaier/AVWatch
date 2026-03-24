'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Recent Reports', href: '/#reports' },
  { name: 'News', href: '/#news' },
  { name: 'About', href: '/#about' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Admin routes have their own layout — don't render the public navbar
  if (pathname?.startsWith('/admin')) return null;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-xl shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/25">
              <span className="text-white font-bold text-xs tracking-tight">AV</span>
            </div>
            <span className="font-bold text-slate-900 tracking-tight">
              AV Watch
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navigation.map((item) => (
              item.href.startsWith('/') && !item.href.startsWith('/#') ? (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition rounded-lg"
                >
                  {item.name}
                </Link>
              ) : (
                <a
                  key={item.name}
                  href={item.href}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition rounded-lg"
                >
                  {item.name}
                </a>
              )
            ))}
          </div>

          {/* Report Button */}
          <div className="hidden md:flex items-center">
            <a
              href="/#report"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition"
            >
              Report Incident
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              {navigation.map((item) => (
                item.href.startsWith('/') && !item.href.startsWith('/#') ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    {item.name}
                  </a>
                )
              ))}
              <a
                href="/#report"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 rounded-xl bg-blue-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-blue-700 transition"
              >
                Report Incident →
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
