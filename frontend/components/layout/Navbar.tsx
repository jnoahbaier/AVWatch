'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, MapPin, BarChart3, FileText, Info } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Map', href: '/map', icon: MapPin },
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Report', href: '/report', icon: FileText },
  { name: 'About', href: '/about', icon: Info },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">AV</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              AV Watch
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Report Button (Desktop) */}
          <div className="hidden md:block">
            <Link
              href="/report"
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-400"
            >
              Report Incident
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition',
                      isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
              <Link
                href="/report"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 rounded-lg bg-green-500 px-4 py-3 text-center text-base font-semibold text-white"
              >
                Report Incident
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

