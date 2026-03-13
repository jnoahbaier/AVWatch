import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NewsItem } from '@avwatch/shared';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const SOURCE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'The Robot Report': { bg: colors.primary[50], text: colors.primary[600] },
  'IEEE Spectrum': { bg: '#faf5ff', text: '#7c3aed' },
  'Electrek (Waymo)': { bg: colors.green[50], text: colors.green[600] },
  'TechCrunch (Transportation)': { bg: '#fff7ed', text: colors.orange[600] },
  'The Verge (Self-Driving)': { bg: '#fff1f2', text: '#be123c' },
  'Ars Technica (Cars)': { bg: '#fffbeb', text: '#b45309' },
};

const DEFAULT_BADGE = { bg: colors.neutral[100], text: colors.neutral[600] };

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NewsCardProps {
  item: NewsItem;
}

export function NewsCard({ item }: NewsCardProps) {
  const badge = SOURCE_BADGE_COLORS[item.source_name] ?? DEFAULT_BADGE;
  const age = timeAgo(item.published_at);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!item.image_url && !imgFailed;

  const handlePress = () => {
    if (item.url) Linking.openURL(item.url);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      {/* Hero image */}
      {showImage && (
        <Image
          source={{ uri: item.image_url! }}
          style={styles.heroImage}
          resizeMode="cover"
          onError={() => setImgFailed(true)}
        />
      )}

      <View style={styles.content}>
        {/* Source badge + age */}
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {item.source_name}
            </Text>
          </View>
          {age ? (
            <Text style={styles.age}>{age}</Text>
          ) : null}
        </View>

        {/* Headline */}
        <Text style={styles.title} numberOfLines={3}>
          {item.title}
        </Text>

        {/* Summary */}
        {item.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.readMore}>Read more</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.green[600]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.neutral[100],
  },
  content: {
    padding: spacing.base,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
  },
  badgeText: {
    ...typography.overline,
    fontSize: 10,
  },
  age: {
    ...typography.caption,
    color: colors.neutral[400],
    flexShrink: 0,
  },
  title: {
    ...typography.smallMedium,
    color: colors.neutral[900],
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  summary: {
    ...typography.caption,
    color: colors.neutral[500],
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.xs,
  },
  readMore: {
    ...typography.captionMedium,
    color: colors.green[600],
  },
});
