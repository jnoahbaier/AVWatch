import { useState, useCallback } from 'react';
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
import { Card, SectionHeader, KPICard } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { INCIDENT_TYPE_LABELS, INCIDENT_TYPE_COLORS, AV_COMPANY_LABELS, COMPANY_COLORS } from '@/lib/constants';

const screenWidth = Dimensions.get('window').width;

const PERIODS = ['Last 30 days', 'This year', 'All time'] as const;

const MOCK_BY_TYPE = [
  { label: 'Collision', value: 312, color: INCIDENT_TYPE_COLORS.collision },
  { label: 'Near Miss', value: 498, color: INCIDENT_TYPE_COLORS.near_miss },
  { label: 'Sudden Behavior', value: 215, color: INCIDENT_TYPE_COLORS.sudden_behavior },
  { label: 'Blockage', value: 189, color: INCIDENT_TYPE_COLORS.blockage },
  { label: 'Other', value: 70, color: INCIDENT_TYPE_COLORS.other },
];

const MOCK_BY_COMPANY = [
  { label: 'Waymo', value: 520, color: COMPANY_COLORS.waymo },
  { label: 'Cruise', value: 380, color: COMPANY_COLORS.cruise },
  { label: 'Zoox', value: 145, color: COMPANY_COLORS.zoox },
  { label: 'Tesla', value: 95, color: COMPANY_COLORS.tesla },
  { label: 'Other', value: 144, color: COMPANY_COLORS.other },
];

const MOCK_MONTHLY = [
  { label: 'Jan', value: 85 },
  { label: 'Feb', value: 92 },
  { label: 'Mar', value: 110 },
  { label: 'Apr', value: 98 },
  { label: 'May', value: 125 },
  { label: 'Jun', value: 142 },
  { label: 'Jul', value: 138 },
];

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('This year');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const total = MOCK_BY_TYPE.reduce((s, d) => s + d.value, 0);

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
            <Text style={styles.totalValue}>{total.toLocaleString()}</Text>
            <View style={styles.trendPill}>
              <Ionicons name="trending-up" size={14} color={colors.green[600]} />
              <Text style={styles.trendPillText}>+14.5% ↑</Text>
            </View>
          </View>
          <Text style={styles.totalSub}>Total reported · {period}</Text>
        </Card>

        {/* By Type */}
        <SectionHeader title="By Incident Type" />
        <Card style={styles.chartCard}>
          <BarChart data={MOCK_BY_TYPE} showPercentage />
        </Card>

        {/* By Company */}
        <SectionHeader title="By Company" />
        <Card style={styles.chartCard}>
          <BarChart data={MOCK_BY_COMPANY} showPercentage />
        </Card>

        {/* Trend over time */}
        <SectionHeader title="Trend Over Time" />
        <Card style={styles.chartCard}>
          <View style={styles.trendHeader}>
            <Text style={styles.trendTotal}>1.5k</Text>
            <View style={styles.trendPill}>
              <Ionicons name="trending-up" size={12} color={colors.green[600]} />
              <Text style={[styles.trendPillText, { fontSize: 11 }]}>+8.5% ↑</Text>
            </View>
          </View>
          <Text style={styles.trendSub}>Total incidents</Text>
          <View style={styles.lineChartWrap}>
            <LineChart
              data={MOCK_MONTHLY}
              width={screenWidth - 72}
              height={180}
              color={colors.primary[500]}
              highlightLast
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
});
