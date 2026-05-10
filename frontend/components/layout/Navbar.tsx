'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Recent Reports', href: '/#reports' },
  // { name: 'News', href: '/#news' },
  { name: 'About', href: '/#about' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) return null;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">

          {/* Logo group */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/navbar_logo_final.png"
              alt="AV Watch"
              width={160}
              height={40}
              className="h-[32px] w-auto object-contain"
              priority
            />
            <div className="flex items-center self-center border-l border-slate-200 pl-3 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Berkeley I School Logo Blue.png"
                alt="UC Berkeley School of Information"
                className="w-auto block h-[24px] sm:h-[26px]"
                style={{ transform: 'translateY(0px)' }}
              />
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navigation.map((item) =>
              item.href.startsWith('/') && !item.href.startsWith('/#') ? (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm text-slate-500 hover:text-[#2C3E50] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] focus-visible:rounded-md"
                >
                  {item.name}
                </Link>
              ) : (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-sm text-slate-500 hover:text-[#2C3E50] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] focus-visible:rounded-md"
                >
                  {item.name}
                </a>
              )
            )}
            <a
              href="/#report"
              className="text-sm font-semibold text-white bg-[#5B9DFF] hover:bg-[#3A72D9] px-4 py-1.5 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-[#5B9DFF] focus:ring-offset-2"
            >
              Report an Incident
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            className="md:hidden p-3 -mr-1 text-slate-400 hover:text-[#2C3E50] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] focus-visible:rounded-md"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div id="mobile-nav" className="md:hidden pb-4 border-t border-slate-100">
            <div className="flex flex-col gap-0.5 pt-2">
              {navigation.map((item) =>
                item.href.startsWith('/') && !item.href.startsWith('/#') ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#2C3E50] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF]"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#2C3E50] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF]"
                  >
                    {item.name}
                  </a>
                )
              )}
              <div className="pt-2 px-1">
                <a
                  href="/#report"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg bg-[#5B9DFF] hover:bg-[#3A72D9] px-4 py-2.5 text-center text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#5B9DFF]"
                >
                  Report an Incident
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
