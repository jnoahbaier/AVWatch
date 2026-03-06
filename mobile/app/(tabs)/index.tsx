import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KPICard, Card, SectionHeader } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

const screenWidth = Dimensions.get('window').width;

// Placeholder data — wired to live API once backend is running
const MOCK_STATS = {
  total: 1284,
  thisMonth: 142,
  verified: 891,
  sources: 3,
  trend: 5.8,
};

const MOCK_MONTHLY = [
  { label: 'Jan', value: 85 },
  { label: 'Feb', value: 92 },
  { label: 'Mar', value: 110 },
  { label: 'Apr', value: 98 },
  { label: 'May', value: 125 },
  { label: 'Jun', value: 142 },
  { label: 'Jul', value: 138 },
];

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(MOCK_STATS);
  const [monthly, setMonthly] = useState(MOCK_MONTHLY);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: fetch from real API
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

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
            value={stats.total.toLocaleString()}
            trend={stats.trend}
            trendLabel="Last 30 days"
          />
          <KPICard
            icon={<Ionicons name="calendar-outline" size={18} color={colors.green[600]} />}
            iconBg={colors.green[50]}
            label="This Month"
            value={stats.thisMonth.toLocaleString()}
            trend={3.2}
            trendLabel="Last 30 days"
          />
        </View>
        <View style={styles.kpiGrid}>
          <KPICard
            icon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.purple[600]} />}
            iconBg={colors.purple[50]}
            label="Verified"
            value={stats.verified.toLocaleString()}
          />
          <KPICard
            icon={<Ionicons name="server-outline" size={18} color={colors.orange[600]} />}
            iconBg={colors.orange[50]}
            label="Data Sources"
            value={stats.sources}
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
        <SectionHeader title="Incident Trend" action="This year" />
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTotal}>{stats.total.toLocaleString()}</Text>
            <View style={styles.chartTrend}>
              <Ionicons name="trending-up" size={14} color={colors.green[600]} />
              <Text style={styles.chartTrendText}>+{stats.trend}% ↑</Text>
            </View>
          </View>
          <Text style={styles.chartSubtitle}>total reported</Text>
          <View style={styles.chartWrap}>
            <LineChart
              data={monthly}
              width={screenWidth - 72}
              height={180}
              color={colors.primary[500]}
            />
          </View>
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
