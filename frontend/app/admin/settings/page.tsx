'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_EMAILS } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

interface Stats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  corroborated: number;
  this_week: number;
  blocked_ips: number;
}

interface BlockedIP {
  id: string;
  ip_hash: string;
  reason: string;
  blocked_by: string;
  blocked_at: string;
}

interface AllowlistEntry {
  email: string;
  added_at: string;
}

export default function AdminSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingIPs, setLoadingIPs] = useState(true);
  const [loadingAllowlist, setLoadingAllowlist] = useState(true);
  const [toast, setToast] = useState('');

  // Allowlist form
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);

  // Block IP form
  const [blockIpHash, setBlockIpHash] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockingIP, setBlockingIP] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/admin/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoadingStats(false); })
      .catch(() => setLoadingStats(false));

    fetch('/api/admin/blocked-ips')
      .then(r => r.json())
      .then(d => { setBlockedIPs(Array.isArray(d) ? d : []); setLoadingIPs(false); })
      .catch(() => setLoadingIPs(false));

    fetch('/api/admin/allowlist')
      .then(r => r.json())
      .then(d => { setAllowlist(Array.isArray(d) ? d : []); setLoadingAllowlist(false); })
      .catch(() => { setLoadingAllowlist(false); });
  }, []);

  async function handleUnblock(id: string) {
    const res = await fetch(`/api/admin/blocked-ips/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setBlockedIPs(ips => ips.filter(ip => ip.id !== id));
      showToast('IP unblocked');
    } else {
      showToast('Error — could not unblock');
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAddingEmail(true);
    try {
      const res = await fetch('/api/admin/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setAllowlist(list => [...list, { email, added_at: new Date().toISOString() }]);
        setNewEmail('');
        showToast(`${email} added to allowlist`);
      } else {
        const data = await res.json();
        showToast(data.detail === 'Email already on allowlist'
          ? 'That email is already on the allowlist'
          : 'Error — could not add email');
      }
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleRemoveEmail(email: string) {
    if (email === session?.user?.email) {
      showToast('You cannot remove yourself from the allowlist');
      return;
    }
    const res = await fetch(`/api/admin/allowlist/${encodeURIComponent(email)}`, { method: 'DELETE' });
    if (res.ok) {
      setAllowlist(list => list.filter(e => e.email !== email));
      showToast(`${email} removed`);
    } else {
      showToast('Error — could not remove email');
    }
  }

  async function handleBlockIP(e: React.FormEvent) {
    e.preventDefault();
    const ipHash = blockIpHash.trim();
    const reason = blockReason.trim() || 'Manual block';
    if (!ipHash) return;
    setBlockingIP(true);
    try {
      const res = await fetch('/api/admin/blocked-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_hash: ipHash, reason }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setBlockedIPs(ips => [{
          id: crypto.randomUUID(),
          ip_hash: ipHash,
          reason,
          blocked_by: session?.user?.email ?? 'unknown',
          blocked_at: now,
        }, ...ips]);
        setBlockIpHash('');
        setBlockReason('');
        showToast('IP blocked');
        // Refresh to get real ID from server
        fetch('/api/admin/blocked-ips')
          .then(r => r.json())
          .then(d => setBlockedIPs(Array.isArray(d) ? d : []));
      } else {
        const data = await res.json();
        showToast(data.detail === 'IP hash already blocked'
          ? 'That IP hash is already blocked'
          : 'Error — could not block IP');
      }
    } finally {
      setBlockingIP(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">AV</span>
            </div>
            <span className="text-white font-semibold">Admin</span>
            <span className="text-slate-600">/</span>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Reports Queue
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm">Settings</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:block">{session?.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Platform Stats */}
        <section>
          <h2 className="text-white font-semibold text-base mb-4">Platform stats</h2>
          {loadingStats ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total reports', value: stats.total, color: 'text-white' },
                { label: 'Pending review', value: stats.pending, color: 'text-yellow-400' },
                { label: 'Validated', value: stats.verified, color: 'text-green-400' },
                { label: 'Discarded', value: stats.rejected, color: 'text-red-400' },
                { label: 'Corroborated', value: stats.corroborated, color: 'text-blue-400' },
                { label: 'This week', value: stats.this_week, color: 'text-white' },
                { label: 'Blocked IPs', value: stats.blocked_ips, color: 'text-orange-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <p className="text-slate-500 text-xs mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Could not load stats.</p>
          )}
        </section>

        {/* Admin allowlist */}
        <section>
          <h2 className="text-white font-semibold text-base mb-1">Admin allowlist</h2>
          <p className="text-slate-500 text-sm mb-4">
            These accounts can access the admin portal. Changes take effect at next login.
          </p>

          {/* Add email form */}
          <form onSubmit={handleAddEmail} className="flex gap-2 mb-4">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="new.admin@berkeley.edu"
              className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
            />
            <button
              type="submit"
              disabled={addingEmail || !newEmail.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors whitespace-nowrap"
            >
              {addingEmail ? 'Adding…' : '+ Add'}
            </button>
          </form>

          {loadingAllowlist ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {allowlist.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">
                  No entries — add one above. (Fallback: hardcoded list in auth.ts)
                </div>
              ) : (
                allowlist.map((entry, i) => (
                  <div
                    key={entry.email}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i < allowlist.length - 1 ? 'border-b border-slate-800' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <span className="text-blue-400 text-xs font-semibold">
                          {entry.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-slate-200 text-sm font-mono">{entry.email}</p>
                        <p className="text-slate-600 text-xs">Added {formatDate(entry.added_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.email === session?.user?.email && (
                        <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoveEmail(entry.email)}
                        disabled={entry.email === session?.user?.email}
                        title={entry.email === session?.user?.email ? "Can't remove yourself" : "Remove"}
                        className="px-2.5 py-1 text-xs bg-slate-700/40 hover:bg-red-600/20 hover:text-red-400 hover:border-red-600/30 text-slate-400 border border-slate-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <p className="text-slate-600 text-xs mt-2">
            Note: if the DB allowlist is empty, the hardcoded list in{' '}
            <code className="text-slate-500 bg-slate-800 px-1 rounded">frontend/lib/auth.ts</code>{' '}
            is used as a fallback.
          </p>
        </section>

        {/* Block IP manually */}
        <section>
          <h2 className="text-white font-semibold text-base mb-1">Block an IP</h2>
          <p className="text-slate-500 text-sm mb-4">
            Manually block an IP hash (SHA-256). You can copy a hash from the Reports Queue.
          </p>
          <form onSubmit={handleBlockIP} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-slate-400 text-xs mb-1">IP hash (SHA-256)</label>
              <input
                type="text"
                value={blockIpHash}
                onChange={e => setBlockIpHash(e.target.value)}
                placeholder="64-character hex hash"
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 font-mono placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Reason (optional)</label>
              <input
                type="text"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                placeholder="e.g. spam, fake reports…"
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={blockingIP || !blockIpHash.trim()}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {blockingIP ? 'Blocking…' : 'Block IP'}
              </button>
            </div>
          </form>
        </section>

        {/* Blocked IPs list */}
        <section>
          <h2 className="text-white font-semibold text-base mb-1">Blocked IPs</h2>
          <p className="text-slate-500 text-sm mb-4">
            IPs blocked from submitting reports. Hashed with SHA-256 — original IP is never stored.
          </p>
          {loadingIPs ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : blockedIPs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-8 text-center text-slate-500 text-sm">
              No blocked IPs.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">IP hash</th>
                    <th className="text-left px-4 py-3 font-medium">Reason</th>
                    <th className="text-left px-4 py-3 font-medium">Blocked by</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-right px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {blockedIPs.map((ip, i) => (
                    <tr
                      key={ip.id}
                      className={i < blockedIPs.length - 1 ? 'border-b border-slate-800/60' : ''}
                    >
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                        {ip.ip_hash.slice(0, 16)}…
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">
                        {ip.reason}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{ip.blocked_by}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(ip.blocked_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleUnblock(ip.id)}
                          className="px-2.5 py-1 text-xs bg-slate-700/40 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Environment info */}
        <section>
          <h2 className="text-white font-semibold text-base mb-4">Environment</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {[
              { label: 'Backend URL', value: process.env.NEXT_PUBLIC_API_URL || 'Not set' },
              { label: 'Environment', value: process.env.NODE_ENV || 'unknown' },
            ].map(({ label, value }, i, arr) => (
              <div
                key={label}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < arr.length - 1 ? 'border-b border-slate-800' : ''
                }`}
              >
                <span className="text-slate-400 text-sm">{label}</span>
                <span className="text-slate-300 font-mono text-xs">{value}</span>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white text-sm px-5 py-2.5 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
