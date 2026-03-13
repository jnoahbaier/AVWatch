import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { NewsItem } from '@avwatch/shared';
import { NewsCard } from '@/components/news/NewsCard';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

// Points at the Next.js /api/news route when no backend URL is configured.
// Use your machine's LAN IP so a physical device on the same WiFi can reach it.
const NEWS_URL =
  process.env.EXPO_PUBLIC_NEWS_URL ||
  (process.env.EXPO_PUBLIC_API_URL
    ? `${process.env.EXPO_PUBLIC_API_URL}/api/news/`
    : 'http://localhost:3000/api/news');

async function fetchNews(limit = 30): Promise<NewsItem[]> {
  const url = `${NEWS_URL}?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`News fetch failed: ${res.status}`);
  return res.json();
}

type ListItem =
  | { type: 'header' }
  | { type: 'report_cta' }
  | { type: 'section_title' }
  | { type: 'news'; item: NewsItem }
  | { type: 'empty' }
  | { type: 'error'; message: string };

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const items = await fetchNews(30);
      setNews(items);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.warn('[HomeScreen] Failed to load news:', message);
      setError('Could not load news. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const listData = useCallback((): ListItem[] => {
    const items: ListItem[] = [
      { type: 'header' },
      { type: 'report_cta' },
      { type: 'section_title' },
    ];
    if (loading) {
      return items;
    }
    if (error) {
      items.push({ type: 'error', message: error });
      return items;
    }
    if (news.length === 0) {
      items.push({ type: 'empty' });
      return items;
    }
    for (const n of news) {
      items.push({ type: 'news', item: n });
    }
    return items;
  }, [loading, error, news]);

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>AV Watch</Text>
              <Text style={styles.subtitle}>Latest News</Text>
            </View>
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => router.push('/(tabs)/map')}
            >
              <Ionicons name="map-outline" size={20} color={colors.neutral[600]} />
            </TouchableOpacity>
          </View>
        );

      case 'report_cta':
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/report')}
            style={styles.ctaWrapper}
          >
            <LinearGradient
              colors={['#16a34a', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="warning-outline" size={22} color="#fff" />
              </View>
              <View style={styles.ctaText}>
                <Text style={styles.ctaTitle}>Report an Incident</Text>
                <Text style={styles.ctaBody}>
                  Witnessed an AV problem? Tap to submit a report.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>
        );

      case 'section_title':
        return (
          <View style={styles.sectionHeader}>
            <Ionicons name="newspaper-outline" size={16} color={colors.neutral[500]} />
            <Text style={styles.sectionTitle}>AV News</Text>
            <Text style={styles.sectionHint}>updated every 30 min</Text>
          </View>
        );

      case 'news':
        return (
          <View style={styles.cardWrapper}>
            <NewsCard item={item.item} />
          </View>
        );

      case 'error':
        return (
          <View style={styles.stateBox}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.neutral[400]} />
            <Text style={styles.stateText}>{item.message}</Text>
          </View>
        );

      case 'empty':
        return (
          <View style={styles.stateBox}>
            <Ionicons name="newspaper-outline" size={28} color={colors.neutral[400]} />
            <Text style={styles.stateText}>No AV news found right now.</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.green[600]} />
          <Text style={styles.loadingText}>Loading news…</Text>
        </View>
      ) : (
        <FlatList
          data={listData()}
          keyExtractor={(item, index) => {
            if (item.type === 'news') return item.item.url;
            return `${item.type}-${index}`;
          }}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.green[600]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.small,
    color: colors.neutral[500],
  },
  listContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
  },
  logo: {
    ...typography.h2,
    color: colors.green[600],
  },
  subtitle: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWrapper: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: colors.green[700],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.md,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaText: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 20,
  },
  ctaBody: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.neutral[700],
  },
  sectionHint: {
    ...typography.caption,
    color: colors.neutral[400],
    marginLeft: 'auto',
  },
  cardWrapper: {
    paddingHorizontal: spacing.base,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
