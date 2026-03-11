import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KPICard, Card, SectionHeader } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { fetchIncidentStats, fetchDailyCounts, type IncidentStats, type DailyCount } from '@/lib/supabase';

const screenWidth = Dimensions.get('window').width;

function buildMonthlyData(daily: DailyCount[]) {
  const byMonth: Record<string, number> = {};
  for (const row of daily) {
    const m = new Date(row.date).toLocaleString('en-US', { month: 'short' });
    byMonth[m] = (byMonth[m] || 0) + row.incident_count;
  }
  return Object.entries(byMonth).map(([label, value]) => ({ label, value }));
}

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [monthly, setMonthly] = useState<{ label: string; value: number }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [statsData, dailyData] = await Promise.all([
        fetchIncidentStats(),
        fetchDailyCounts(180),
      ]);
      setStats(statsData);
      setMonthly(buildMonthlyData(dailyData));
    } catch (e) {
      console.warn('[HomeScreen] Failed to load stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

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
          <View>
            <Text style={styles.logo}>AV Watch</Text>
            <Text style={styles.greeting}>Incident Dashboard</Text>
          </View>
          <View style={styles.headerIcons}>
            <Ionicons name="notifications-outline" size={22} color={colors.neutral[600]} />
          </View>
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <KPICard
            icon={<Ionicons name="alert-circle-outline" size={18} color={colors.primary[600]} />}
            iconBg={colors.primary[50]}
            label="Total Incidents"
            value={loading ? '…' : (stats?.total_incidents ?? 0).toLocaleString()}
          />
          <KPICard
            icon={<Ionicons name="calendar-outline" size={18} color={colors.green[600]} />}
            iconBg={colors.green[50]}
            label="This Month"
            value={loading ? '…' : (stats?.incidents_this_month ?? 0).toLocaleString()}
          />
        </View>
        <View style={styles.kpiGrid}>
          <KPICard
            icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.purple[600]} />}
            iconBg={colors.purple[50]}
            label="Verified"
            value={loading ? '…' : (stats?.verified_incidents ?? 0).toLocaleString()}
          />
          <KPICard
            icon={<Ionicons name="server-outline" size={18} color={colors.orange[600]} />}
            iconBg={colors.orange[50]}
            label="Data Sources"
            value="3"
          />
        </View>

        {/* Insights card */}
        <Card style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <Ionicons name="sparkles" size={20} color={colors.primary[600]} />
          </View>
          <View style={styles.insightText}>
            <Text style={styles.insightTitle}>Community Insights</Text>
            <Text style={styles.insightBody}>
              See how incidents trend across companies and time, powered by NHTSA, CPUC & community reports.
            </Text>
          </View>
          <View style={styles.insightActions}>
            <Text
              style={styles.insightLink}
              onPress={() => router.push('/(tabs)/analytics')}
            >
              View Analytics →
            </Text>
          </View>
        </Card>

        {/* Trend chart */}
        <SectionHeader title="Incident Trend" action="6 months" />
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTotal}>
              {loading ? '…' : (stats?.total_incidents ?? 0).toLocaleString()}
            </Text>
          </View>
          <Text style={styles.chartSubtitle}>total reported</Text>
          {monthly.length > 0 && (
            <View style={styles.chartWrap}>
              <LineChart
                data={monthly}
                width={screenWidth - 72}
                height={180}
                color={colors.primary[500]}
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: spacing.lg,
  },
  logo: {
    ...typography.h2,
    color: colors.primary[600],
  },
  greeting: {
    ...typography.small,
    color: colors.neutral[500],
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  insightCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    flexDirection: 'column',
    gap: spacing.md,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    gap: 4,
  },
  insightTitle: {
    ...typography.bodySemibold,
    color: colors.neutral[900],
  },
  insightBody: {
    ...typography.small,
    color: colors.neutral[500],
    lineHeight: 20,
  },
  insightActions: {
    flexDirection: 'row',
    gap: 16,
  },
  insightLink: {
    ...typography.smallMedium,
    color: colors.primary[600],
  },
  chartCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  chartTotal: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  chartTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chartTrendText: {
    ...typography.captionMedium,
    color: colors.green[600],
  },
  chartSubtitle: {
    ...typography.caption,
    color: colors.neutral[400],
    marginBottom: spacing.base,
  },
  chartWrap: {
    alignItems: 'center',
  },
});
