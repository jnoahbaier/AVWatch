'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Car,
  MapPin,
  Calendar,
  RefreshCw,
  Database,
  Users,
  Shield,
  Loader2,
} from 'lucide-react';
import {
  IncidentTrendChart,
  CompanyBarChart,
  IncidentTypePieChart,
  SourceBreakdownChart,
} from '@/components/charts';
import {
  getIncidentStats,
  getCompanyStats,
  getDataSources,
  getRecentIncidents,
  type IncidentStats,
  type CompanyStats,
  type DataSource,
  type Incident,
} from '@/lib/supabase';
import {
  INCIDENT_TYPE_LABELS,
  AV_COMPANY_LABELS,
  INCIDENT_TYPE_COLORS,
  formatRelativeTime,
} from '@/lib/utils';

export default function DashboardPage() {
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, companyData, sourcesData, recentData] = await Promise.all([
        getIncidentStats().catch(() => null),
        getCompanyStats().catch(() => []),
        getDataSources().catch(() => []),
        getRecentIncidents(5).catch(() => []),
      ]);
      setStats(statsData);
      setCompanyStats(companyData);
      setDataSources(sourcesData);
      setRecentIncidents(recentData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate trends (mock for now)
  const monthlyChange = stats ? '+12%' : undefined;
  const weeklyChange = stats ? '+5%' : undefined;

  // Prepare chart data
  const typeChartData = stats
    ? [
        { type: 'collision', count: stats.collision_count },
        { type: 'near_miss', count: stats.near_miss_count },
        { type: 'sudden_behavior', count: stats.sudden_behavior_count },
        { type: 'blockage', count: stats.blockage_count },
        { type: 'other', count: stats.other_type_count },
      ].filter((d) => d.count > 0)
    : [];

  const companyChartData = companyStats.map((c) => ({
    company: c.av_company,
    total: c.total_incidents,
    collisions: c.collisions,
    near_misses: c.near_misses,
    sudden_behaviors: c.sudden_behaviors,
    blockages: c.blockages,
  }));

  const sourceChartData = stats
    ? [
        { source: 'user_report', count: stats.user_report_count },
        { source: 'nhtsa', count: stats.nhtsa_count },
        { source: 'cpuc', count: stats.cpuc_count },
        { source: 'dmv', count: stats.dmv_count },
      ].filter((d) => d.count > 0)
    : [];

  // Mock trend data for line chart
  const trendData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      total: Math.floor(Math.random() * 10) + 1,
      collision: Math.floor(Math.random() * 3),
      near_miss: Math.floor(Math.random() * 5),
      sudden_behavior: Math.floor(Math.random() * 4),
      blockage: Math.floor(Math.random() * 3),
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          <p className="text-slate-600 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Real-time insights into AV incidents across the Bay Area
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={<AlertTriangle className="w-6 h-6" />}
            label="Total Incidents"
            value={stats?.total_incidents?.toString() || '0'}
            color="orange"
          />
          <MetricCard
            icon={<Shield className="w-6 h-6" />}
            label="Verified Reports"
            value={stats?.verified_incidents?.toString() || '0'}
            color="green"
          />
          <MetricCard
            icon={<Calendar className="w-6 h-6" />}
            label="This Month"
            value={stats?.incidents_this_month?.toString() || '0'}
            change={monthlyChange}
            isPositive={false}
            color="blue"
          />
          <MetricCard
            icon={<Users className="w-6 h-6" />}
            label="This Week"
            value={stats?.incidents_this_week?.toString() || '0'}
            change={weeklyChange}
            isPositive={false}
            color="purple"
          />
        </div>

        {/* Safety Stats Row */}
        {(stats?.total_fatalities || stats?.total_injuries) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400">Total Fatalities</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {stats?.total_fatalities || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-orange-600 dark:text-orange-400">Total Injuries</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {stats?.total_injuries || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Trend Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Incident Trends (30 Days)
            </h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Daily activity
            </div>
          </div>
          <IncidentTrendChart data={trendData} showByType height={350} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Incidents by Type */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Incidents by Type
            </h3>
            {typeChartData.length > 0 ? (
              <IncidentTypePieChart data={typeChartData} height={280} />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-500">
                No incident data available
              </div>
            )}
          </div>

          {/* Incidents by Company */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Incidents by Company
            </h3>
            {companyChartData.length > 0 ? (
              <CompanyBarChart data={companyChartData} showBreakdown height={280} />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-500">
                No company data available
              </div>
            )}
          </div>
        </div>

        {/* Data Sources & Recent Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Data Sources */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Data Sources
              </h3>
            </div>
            
            {sourceChartData.length > 0 && (
              <div className="mb-6">
                <SourceBreakdownChart data={sourceChartData} height={180} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dataSources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
              {dataSources.length === 0 && (
                <p className="col-span-2 text-center text-slate-500 py-4">
                  No data sources configured
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Recent Reports
              </h3>
              <a
                href="/map"
                className="text-sm font-medium text-green-600 hover:text-green-500"
              >
                View all →
              </a>
            </div>
            <div className="space-y-3">
              {recentIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        INCIDENT_TYPE_COLORS[incident.incident_type] || '#64748b',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {INCIDENT_TYPE_LABELS[incident.incident_type] || incident.incident_type}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {AV_COMPANY_LABELS[incident.av_company || 'unknown']} •{' '}
                      {incident.city}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatRelativeTime(incident.occurred_at)}
                  </span>
                </div>
              ))}
              {recentIncidents.length === 0 && (
                <p className="text-center text-slate-500 py-4">
                  No recent incidents
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Company Comparison Table */}
        {companyStats.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
              Company Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Company</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Total</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Collisions</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Near Misses</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Sudden Behavior</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Blockages</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Fatalities</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Injuries</th>
                  </tr>
                </thead>
                <tbody>
                  {companyStats.map((company) => (
                    <tr
                      key={company.av_company}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {AV_COMPANY_LABELS[company.av_company] || company.av_company}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {company.total_incidents}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600">{company.collisions}</td>
                      <td className="py-3 px-4 text-right text-orange-600">{company.near_misses}</td>
                      <td className="py-3 px-4 text-right text-yellow-600">{company.sudden_behaviors}</td>
                      <td className="py-3 px-4 text-right text-indigo-600">{company.blockages}</td>
                      <td className="py-3 px-4 text-right text-red-700 font-medium">
                        {company.total_fatalities}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-700 font-medium">
                        {company.total_injuries}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Last Updated */}
        {stats?.last_updated && (
          <p className="mt-6 text-center text-sm text-slate-500">
            Data last updated: {formatRelativeTime(stats.last_updated)}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  change,
  isPositive = true,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  color: 'orange' | 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900 dark:text-white">
          {value}
        </span>
        {change && (
          <span
            className={`text-sm font-medium flex items-center ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  const statusColor = source.is_active
    ? source.last_synced_at
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';

  const statusLabel = source.is_active
    ? source.last_synced_at
      ? 'Active'
      : 'Pending'
    : 'Inactive';

  return (
    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-slate-900 dark:text-white">{source.name}</h4>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white mb-1">
        {source.records_count.toLocaleString()}
      </p>
      <p className="text-xs text-slate-500 line-clamp-2">{source.description}</p>
      {source.last_synced_at && (
        <p className="text-xs text-slate-400 mt-2">
          Synced: {formatRelativeTime(source.last_synced_at)}
        </p>
      )}
    </div>
  );
}
