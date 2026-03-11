import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionHeader } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { INCIDENT_TYPE_COLORS, COMPANY_COLORS } from '@/lib/constants';
import { fetchIncidentStats, fetchCompanyStats, fetchDailyCounts, type IncidentStats, type CompanyStats, type DailyCount } from '@/lib/supabase';

const screenWidth = Dimensions.get('window').width;

const PERIODS = ['Last 30 days', 'This year', 'All time'] as const;

function buildMonthlyData(daily: DailyCount[]) {
  const byMonth: Record<string, number> = {};
  for (const row of daily) {
    const m = new Date(row.date).toLocaleString('en-US', { month: 'short' });
    byMonth[m] = (byMonth[m] || 0) + row.incident_count;
  }
  return Object.entries(byMonth).map(([label, value]) => ({ label, value }));
}

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('This year');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [monthly, setMonthly] = useState<{ label: string; value: number }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const days = period === 'Last 30 days' ? 30 : period === 'This year' ? 365 : 3650;
      const [statsData, companyData, dailyData] = await Promise.all([
        fetchIncidentStats(),
        fetchCompanyStats(),
        fetchDailyCounts(days),
      ]);
      setStats(statsData);
      setCompanyStats(companyData);
      setMonthly(buildMonthlyData(dailyData));
    } catch (e) {
      console.warn('[AnalyticsScreen] Failed to load data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const byType = stats ? [
    { label: 'Collision', value: stats.collision_count, color: INCIDENT_TYPE_COLORS.collision },
    { label: 'Near Miss', value: stats.near_miss_count, color: INCIDENT_TYPE_COLORS.near_miss },
    { label: 'Sudden Behavior', value: stats.sudden_behavior_count, color: INCIDENT_TYPE_COLORS.sudden_behavior },
    { label: 'Blockage', value: stats.blockage_count, color: INCIDENT_TYPE_COLORS.blockage },
    { label: 'Other', value: stats.other_type_count, color: INCIDENT_TYPE_COLORS.other },
  ].filter((d) => d.value > 0) : [];

  const byCompany = companyStats.map((c) => ({
    label: c.av_company.charAt(0).toUpperCase() + c.av_company.slice(1),
    value: c.total_incidents,
    color: (COMPANY_COLORS as Record<string, string>)[c.av_company] || colors.neutral[400],
  }));

  const total = stats?.total_incidents ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Ionicons name="calendar-outline" size={22} color={colors.neutral[600]} />
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, period === p && styles.periodChipActive]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[styles.periodText, period === p && styles.periodTextActive]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total KPI */}
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Incidents</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{loading ? '…' : total.toLocaleString()}</Text>
          </View>
          <Text style={styles.totalSub}>Total reported · {period}</Text>
        </Card>

        {/* By Type */}
        <SectionHeader title="By Incident Type" />
        <Card style={styles.chartCard}>
          {byType.length > 0 ? (
            <BarChart data={byType} showPercentage />
          ) : (
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No data'}</Text>
          )}
        </Card>

        {/* By Company */}
        <SectionHeader title="By Company" />
        <Card style={styles.chartCard}>
          {byCompany.length > 0 ? (
            <BarChart data={byCompany} showPercentage />
          ) : (
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No data'}</Text>
          )}
        </Card>

        {/* Trend over time */}
        <SectionHeader title="Trend Over Time" />
        <Card style={styles.chartCard}>
          <View style={styles.trendHeader}>
            <Text style={styles.trendTotal}>
              {loading ? '…' : total.toLocaleString()}
            </Text>
          </View>
          <Text style={styles.trendSub}>Total incidents</Text>
          {monthly.length > 0 && (
            <View style={styles.lineChartWrap}>
              <LineChart
                data={monthly}
                width={screenWidth - 72}
                height={180}
                color={colors.primary[500]}
                highlightLast
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
  },
  periodChipActive: {
    backgroundColor: colors.primary[600],
  },
  periodText: {
    ...typography.captionMedium,
    color: colors.neutral[600],
  },
  periodTextActive: {
    color: '#fff',
  },
  totalCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  totalLabel: {
    ...typography.small,
    color: colors.neutral[500],
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  totalValue: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.green[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  trendPillText: {
    ...typography.captionMedium,
    color: colors.green[600],
  },
  totalSub: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: 4,
  },
  chartCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 2,
  },
  trendTotal: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  trendSub: {
    ...typography.caption,
    color: colors.neutral[400],
    marginBottom: spacing.md,
  },
  lineChartWrap: {
    alignItems: 'center',
  },
  emptyText: {
    ...typography.small,
    color: colors.neutral[400],
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
