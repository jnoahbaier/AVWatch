'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { usePathname } from 'next/navigation';

function scrollToReportSection() {
  document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const navigation = [
  { name: 'Recent Reports', href: '/#reports' },
  { name: 'News', href: '/#news' },
  { name: 'About', href: '/#about' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const goToReportSection = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (pathname === '/') {
      scrollToReportSection();
    } else {
      window.location.assign('/#report');
    }
  };

  if (pathname?.startsWith('/admin')) return null;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">

          {/* Logo group */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/navbar_logo.png"
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
                width={160}
                height={26}
                className="w-auto block h-[24px] sm:h-[26px] max-h-[26px] object-contain object-left"
                /* If Tailwind fails to load, keep logo from rendering at intrinsic PNG size */
                style={{ maxHeight: 26, width: 'auto', height: 'auto', objectFit: 'contain' }}
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
                  className="text-sm text-slate-500 hover:text-[#2C3E50] transition"
                >
                  {item.name}
                </Link>
              ) : (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-sm text-slate-500 hover:text-[#2C3E50] transition"
                >
                  {item.name}
                </a>
              )
            )}
            <a
              href="/#report"
              onClick={goToReportSection}
              className="text-sm font-semibold text-white bg-[#5B9DFF] hover:bg-[#3A72D9] px-4 py-1.5 rounded-lg transition"
            >
              Report an Incident
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 text-slate-400 hover:text-[#2C3E50] transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-slate-100">
            <div className="flex flex-col gap-0.5 pt-2">
              {navigation.map((item) =>
                item.href.startsWith('/') && !item.href.startsWith('/#') ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#2C3E50] transition"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#2C3E50] transition"
                  >
                    {item.name}
                  </a>
                )
              )}
              <div className="pt-2 px-1">
                <a
                  href="/#report"
                  onClick={goToReportSection}
                  className="block rounded-lg bg-[#5B9DFF] hover:bg-[#3A72D9] px-4 py-2.5 text-center text-sm font-semibold text-white transition"
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
