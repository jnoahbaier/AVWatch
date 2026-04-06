'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { formatDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Incident {
  id: string;
  incident_type: string;
  av_company: string;
  description: string | null;
  address: string | null;
  city: string;
  occurred_at: string;
  reported_at: string;
  reporter_type: string | null;
  status: string;
  source: string;
  media_urls: string[];
  reporter_ip_hash: string | null;
  admin_note: string | null;
  corroborated_with_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  latitude: number;
  longitude: number;
}

interface Stats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  corroborated: number;
  this_week: number;
  blocked_ips: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unverified: { label: 'Pending', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  verified: { label: 'Validated', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  rejected: { label: 'Discarded', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  corroborated: { label: 'Corroborated', color: 'bg-[#5B9DFF]/15 text-blue-400 border-[#5B9DFF]/30' },
};

const TYPE_LABELS: Record<string, string> = {
  collision: 'Collision',
  near_miss: 'Near Miss',
  sudden_behavior: 'Driving Incident',
  blockage: 'Blockage',
  vandalism: 'Vandalism',
  other: 'Other',
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  incident,
  onClose,
  onNoteSaved,
}: {
  incident: Incident;
  onClose: () => void;
  onNoteSaved: (id: string, note: string) => void;
}) {
  const statusMeta = STATUS_LABELS[incident.status] ?? { label: incident.status, color: 'bg-slate-700 text-slate-300 border-slate-600' };
  const [note, setNote] = useState(incident.admin_note ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Detect if a URL is a video
  const isVideo = (url: string) =>
    /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url) || url.includes('video');

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/incidents/${incident.id}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: note }),
      });
      if (res.ok) {
        onNoteSaved(incident.id, note);
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C3E50]/75 px-4 py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#415A73] bg-[#34495E]">
        {/* Header */}
        <div className="sticky top-0 flex items-start justify-between border-b border-[#415A73] bg-[#34495E] p-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
              <span className="text-slate-400 text-xs font-mono">{incident.id.slice(0, 8)}…</span>
            </div>
            <h2 className="text-white font-semibold text-lg">
              {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
              {' · '}
              <span className="capitalize">{incident.av_company}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-xl leading-none ml-4 mt-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Occurred', value: formatDate(incident.occurred_at) },
              { label: 'Reported', value: formatDate(incident.reported_at) },
              { label: 'Location', value: incident.address ?? incident.city },
              { label: 'City', value: incident.city },
              { label: 'Source', value: incident.source },
              { label: 'Reporter type', value: incident.reporter_type ?? '—' },
              { label: 'Lat / Lng', value: `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}` },
              { label: 'IP hash', value: incident.reporter_ip_hash ? incident.reporter_ip_hash.slice(0, 12) + '…' : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                <p className="text-slate-200 font-mono text-xs break-all">{value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Description</p>
            {incident.description ? (
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap bg-slate-800/50 rounded-lg p-4">
                {incident.description}
              </p>
            ) : (
              <p className="text-slate-500 italic text-sm">No description provided.</p>
            )}
          </div>

          {/* Reporter contact */}
          {(incident.contact_name || incident.contact_email) && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Reporter contact</p>
              <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col gap-1">
                {incident.contact_name && (
                  <p className="text-slate-200 text-sm">👤 {incident.contact_name}</p>
                )}
                {incident.contact_email && (
                  <a
                    href={`mailto:${incident.contact_email}`}
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    ✉ {incident.contact_email}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Admin note — editable */}
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Admin note</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Jane — emailed reporter 2026-03-24, awaiting response"
              rows={3}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-yellow-200/80 placeholder:text-slate-600 focus:outline-none focus:border-yellow-700/60 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-3 py-1.5 text-xs bg-yellow-800/30 hover:bg-yellow-700/40 text-yellow-300 border border-yellow-700/40 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingNote ? 'Saving…' : noteSaved ? '✓ Saved' : 'Save note'}
              </button>
            </div>
          </div>

          {/* Corroboration link */}
          {incident.corroborated_with_id && (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Corroborated with</p>
              <p className="text-blue-400 font-mono text-sm">{incident.corroborated_with_id}</p>
            </div>
          )}

          {/* Media */}
          {incident.media_urls.length > 0 ? (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">
                Media ({incident.media_urls.length})
              </p>
              <div className="grid grid-cols-2 gap-3">
                {incident.media_urls.map((url, i) =>
                  isVideo(url) ? (
                    <video
                      key={i}
                      src={url}
                      controls
                      className="w-full rounded-lg bg-black max-h-48 object-contain col-span-1"
                    />
                  ) : (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Media ${i + 1}`}
                        className="w-full rounded-lg object-cover max-h-48 hover:opacity-90 transition-opacity bg-slate-800"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </a>
                  )
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Media</p>
              <p className="text-slate-600 italic text-sm">No media submitted.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#415A73] bg-[#34495E] p-5">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

// ─── Discard Modal ────────────────────────────────────────────────────────────

function DiscardModal({
  incident,
  onConfirm,
  onCancel,
}: {
  incident: Incident;
  onConfirm: (note: string, blockIp: boolean) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [blockIp, setBlockIp] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C3E50]/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-[#415A73] bg-[#34495E] p-6">
        <h2 className="text-white font-semibold mb-1">Discard report</h2>
        <p className="text-slate-400 text-sm mb-4">
          <span className="font-mono text-slate-300">{incident.id.slice(0, 8)}…</span>{' '}
          · {TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
        </p>

        <label className="block text-slate-300 text-sm mb-1">Internal note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. spam, duplicate, no location data…"
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 resize-none mb-4"
        />

        {incident.reporter_ip_hash && (
          <label className="flex items-center gap-2 text-sm text-slate-300 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={blockIp}
              onChange={(e) => setBlockIp(e.target.checked)}
              className="accent-red-500"
            />
            Also block this reporter&apos;s IP from future submissions
          </label>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(note, blockIp)}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Corroborate Modal ────────────────────────────────────────────────────────

function CorroborateModal({
  incident,
  onConfirm,
  onCancel,
}: {
  incident: Incident;
  onConfirm: (targetId: string) => void;
  onCancel: () => void;
}) {
  const [targetId, setTargetId] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C3E50]/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-[#415A73] bg-[#34495E] p-6">
        <h2 className="text-white font-semibold mb-1">Flag for corroboration</h2>
        <p className="text-slate-400 text-sm mb-4">
          Link this report to another report of the same incident.
        </p>

        <label className="block text-slate-300 text-sm mb-1">Other report ID</label>
        <input
          type="text"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value.trim())}
          placeholder="Paste the UUID of the other report"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500 mb-5 font-mono"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => targetId && onConfirm(targetId)}
            disabled={!targetId}
            className="px-4 py-2 text-sm bg-[#5B9DFF] hover:bg-[#5B9DFF] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Link reports
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: session } = useSession();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Modals
  const [detailTarget, setDetailTarget] = useState<Incident | null>(null);
  const [discardTarget, setDiscardTarget] = useState<Incident | null>(null);
  const [corrobTarget, setCorrobTarget] = useState<Incident | null>(null);

  // Toast
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const PAGE_SIZE = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
        sort_dir: sortDir,
      });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('incident_type', typeFilter);

      const [incRes, statsRes] = await Promise.all([
        fetch(`/api/admin/incidents?${params}`),
        fetch('/api/admin/stats'),
      ]);

      if (!incRes.ok) throw new Error('Failed to load incidents');
      const incData = await incRes.json();
      setIncidents(incData.items);
      setTotal(incData.total);

      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, sortDir]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleValidate(id: string) {
    const res = await fetch(`/api/admin/incidents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    });
    if (res.ok) { showToast('Report validated'); fetchData(); }
    else showToast('Error — could not validate');
  }

  async function handleReset(id: string) {
    const res = await fetch(`/api/admin/incidents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unverified' }),
    });
    if (res.ok) { showToast('Report reset to pending'); fetchData(); }
    else showToast('Error — could not reset');
  }

  async function handleDiscard(incident: Incident, note: string, blockIp: boolean) {
    const res = await fetch(`/api/admin/incidents/${incident.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', admin_note: note, block_ip: blockIp }),
    });
    setDiscardTarget(null);
    if (res.ok) { showToast(blockIp ? 'Report discarded + IP blocked' : 'Report discarded'); fetchData(); }
    else showToast('Error — could not discard');
  }

  async function handleBlockIP(incident: Incident) {
    if (!incident.reporter_ip_hash) return;
    const res = await fetch('/api/admin/blocked-ips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip_hash: incident.reporter_ip_hash,
        reason: `Flagged from reports queue — report ${incident.id.slice(0, 8)}`,
      }),
    });
    if (res.ok) showToast('IP blocked');
    else {
      const data = await res.json();
      showToast(data.detail === 'IP hash already blocked' ? 'IP already blocked' : 'Error blocking IP');
    }
  }

  async function handleCorroborate(incidentId: string, targetId: string) {
    const res = await fetch(`/api/admin/incidents/${incidentId}/corroborate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_incident_id: targetId }),
    });
    setCorrobTarget(null);
    if (res.ok) { showToast('Reports linked as corroborating'); fetchData(); }
    else showToast('Error — could not link reports');
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#2C3E50]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#415A73] bg-[#2C3E50]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#5B9DFF] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">AV</span>
            </div>
            <span className="text-white font-semibold">Admin</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 text-sm">Reports Queue</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm hidden sm:block">{session?.user?.email}</span>
            <a
              href="/admin/settings"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Settings
            </a>
            <button
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Pending" value={stats.pending} accent="text-yellow-400" />
            <StatCard label="Validated" value={stats.verified} accent="text-green-400" />
            <StatCard label="Discarded" value={stats.rejected} accent="text-red-400" />
            <StatCard label="Corroborated" value={stats.corroborated} accent="text-blue-400" />
            <StatCard label="This week" value={stats.this_week} />
            <StatCard label="Blocked IPs" value={stats.blocked_ips} accent="text-orange-400" />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#415A73] bg-[#34495E] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-400"
          >
            <option value="">All statuses</option>
            <option value="unverified">Pending</option>
            <option value="verified">Validated</option>
            <option value="rejected">Discarded</option>
            <option value="corroborated">Corroborated</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[#415A73] bg-[#34495E] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-400"
          >
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 rounded-lg border border-[#415A73] bg-[#34495E] px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-400"
          >
            Date {sortDir === 'desc' ? '↓' : '↑'}
          </button>

          <div className="ml-auto text-slate-500 text-sm flex items-center">
            {loading ? 'Loading…' : `${total} report${total !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm mb-5">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#415A73] bg-[#34495E]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#415A73] text-xs uppercase tracking-wider text-slate-400">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Company</th>
                  <th className="text-left px-4 py-3 font-medium">Location</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 py-16">
                      No reports match the current filters.
                    </td>
                  </tr>
                )}
                {incidents.map((inc) => {
                  const statusMeta = STATUS_LABELS[inc.status] ?? {
                    label: inc.status,
                    color: 'bg-slate-700 text-slate-300 border-slate-600',
                  };
                  return (
                    <tr
                      key={inc.id}
                      onClick={() => setDetailTarget(inc)}
                      className="cursor-pointer border-b border-[#415A73]/60 transition-colors hover:bg-[#415A73]/35"
                    >
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {formatDate(inc.reported_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                        {TYPE_LABELS[inc.incident_type] ?? inc.incident_type}
                      </td>
                      <td className="px-4 py-3 text-slate-300 capitalize">
                        {inc.av_company}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[180px] truncate">
                        {inc.address ?? `${inc.city}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">
                        {inc.reporter_ip_hash ? inc.reporter_ip_hash.slice(0, 8) + '…' : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                        {inc.admin_note && (
                          <p className="text-slate-500 text-xs mt-0.5 truncate max-w-[120px]" title={inc.admin_note}>
                            {inc.admin_note}
                          </p>
                        )}
                        {inc.corroborated_with_id && (
                          <p className="text-blue-400 text-xs font-mono mt-0.5" title={inc.corroborated_with_id}>
                            ↔ {inc.corroborated_with_id.slice(0, 8)}…
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">
                        {inc.description ?? <span className="text-slate-600 italic">No description</span>}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {inc.status !== 'verified' ? (
                            <button
                              onClick={() => handleValidate(inc.id)}
                              title="Validate"
                              className="px-2.5 py-1 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 rounded-lg transition-colors"
                            >
                              ✓ Validate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReset(inc.id)}
                              title="Reset to pending"
                              className="px-2.5 py-1 text-xs bg-slate-600/20 hover:bg-slate-600/40 text-slate-400 border border-slate-600/30 rounded-lg transition-colors"
                            >
                              ↺ Reset
                            </button>
                          )}
                          {inc.status !== 'rejected' && (
                            <button
                              onClick={() => setDiscardTarget(inc)}
                              title="Discard"
                              className="px-2.5 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 rounded-lg transition-colors"
                            >
                              ✗ Discard
                            </button>
                          )}
                          {inc.status !== 'corroborated' && (
                            <button
                              onClick={() => setCorrobTarget(inc)}
                              title="Flag for corroboration"
                              className="px-2.5 py-1 text-xs bg-[#5B9DFF]/20 hover:bg-[#5B9DFF]/40 text-blue-400 border border-[#5B9DFF]/30 rounded-lg transition-colors"
                            >
                              ↔ Link
                            </button>
                          )}
                          {inc.reporter_ip_hash && (
                            <button
                              onClick={() => handleBlockIP(inc)}
                              title="Block this IP"
                              className="px-2.5 py-1 text-xs bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-600/30 rounded-lg transition-colors"
                            >
                              ⊘ IP
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#415A73] px-4 py-3 text-sm text-slate-400">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 bg-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {detailTarget && (
        <DetailModal
          incident={detailTarget}
          onClose={() => setDetailTarget(null)}
          onNoteSaved={(id, note) => {
            setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, admin_note: note } : inc));
            setDetailTarget(prev => prev ? { ...prev, admin_note: note } : null);
          }}
        />
      )}
      {discardTarget && (
        <DiscardModal
          incident={discardTarget}
          onConfirm={(note, blockIp) => handleDiscard(discardTarget, note, blockIp)}
          onCancel={() => setDiscardTarget(null)}
        />
      )}
      {corrobTarget && (
        <CorroborateModal
          incident={corrobTarget}
          onConfirm={(targetId) => handleCorroborate(corrobTarget.id, targetId)}
          onCancel={() => setCorrobTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white text-sm px-5 py-2.5 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
