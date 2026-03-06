import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Card, Button } from '@/components/ui';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPE_COLORS,
  AV_COMPANY_LABELS,
} from '@/lib/constants';
import { getIncidents } from '@/lib/api';
import type { Incident } from '@/lib/api';

const SF_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function markerColor(type: string) {
  return INCIDENT_TYPE_COLORS[type] || colors.neutral[500];
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [region, setRegion] = useState<Region>(SF_REGION);

  const [filters, setFilters] = useState({
    types: Object.keys(INCIDENT_TYPE_LABELS),
    companies: Object.keys(AV_COMPANY_LABELS),
  });

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await getIncidents({ limit: 100 });
      setIncidents(result.items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const requestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setRegion({
      ...region,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  }, [region]);

  const filtered = incidents.filter(
    (i) =>
      filters.types.includes(i.incident_type) &&
      filters.companies.includes(i.av_company)
  );

  const toggleFilter = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={SF_REGION}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {filtered.map((inc) => (
          <Marker
            key={inc.id}
            coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
            pinColor={markerColor(inc.incident_type)}
            onPress={() => setSelected(inc)}
          />
        ))}
      </MapView>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      )}

      {/* Error banner */}
      {error && !loading && (
        <SafeAreaView edges={['top']} style={styles.errorBannerWrap} pointerEvents="box-none">
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.neutral[0]} />
            <Text style={styles.errorBannerText}>Could not load incidents</Text>
            <TouchableOpacity onPress={fetchIncidents} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {/* Top bar */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.neutral[400]} />
            <Text style={styles.searchPlaceholder}>Search location…</Text>
          </View>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={20} color={colors.neutral[700]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* My location button */}
      <TouchableOpacity style={styles.locBtn} onPress={requestLocation}>
        <Ionicons name="locate-outline" size={22} color={colors.primary[600]} />
      </TouchableOpacity>

      {/* Incident count badge */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{filtered.length} incidents</Text>
      </View>

      {/* Selected incident sheet */}
      {selected && (
        <View style={styles.sheet}>
          <Card>
            <View style={styles.sheetHeader}>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: markerColor(selected.incident_type) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    { color: markerColor(selected.incident_type) },
                  ]}
                >
                  {INCIDENT_TYPE_LABELS[selected.incident_type] || selected.incident_type}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={colors.neutral[400]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetCompany}>
              {AV_COMPANY_LABELS[selected.av_company] || selected.av_company}
            </Text>
            {selected.description && (
              <Text style={styles.sheetDesc} numberOfLines={2}>
                {selected.description}
              </Text>
            )}
            <Text style={styles.sheetDate}>
              {new Date(selected.occurred_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </Card>
        </View>
      )}

      {/* Filter modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <Ionicons name="close" size={24} color={colors.neutral[600]} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <Text style={styles.filterLabel}>Incident Type</Text>
                <View style={styles.chipRow}>
                  {Object.entries(INCIDENT_TYPE_LABELS).map(([key, label]) => {
                    const active = filters.types.includes(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          setFilters((f) => ({
                            ...f,
                            types: toggleFilter(f.types, key),
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.filterLabel}>Company</Text>
                <View style={styles.chipRow}>
                  {Object.entries(AV_COMPANY_LABELS).map(([key, label]) => {
                    const active = filters.companies.includes(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          setFilters((f) => ({
                            ...f,
                            companies: toggleFilter(f.companies, key),
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Button
                  title="Apply Filters"
                  onPress={() => setShowFilters(false)}
                  size="lg"
                />
              </View>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  errorBannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  errorBannerText: {
    ...typography.captionMedium,
    color: colors.neutral[0],
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary[500],
  },
  retryText: {
    ...typography.captionMedium,
    color: colors.neutral[0],
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchPlaceholder: {
    ...typography.small,
    color: colors.neutral[400],
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  locBtn: {
    position: 'absolute',
    right: spacing.base,
    bottom: 160,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  countBadge: {
    position: 'absolute',
    left: spacing.base,
    bottom: 110,
    backgroundColor: colors.neutral[800],
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  countText: {
    ...typography.captionMedium,
    color: '#fff',
  },
  sheet: {
    position: 'absolute',
    bottom: 100,
    left: spacing.base,
    right: spacing.base,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  typeBadgeText: {
    ...typography.captionMedium,
  },
  sheetCompany: {
    ...typography.bodySemibold,
    color: colors.neutral[900],
  },
  sheetDesc: {
    ...typography.small,
    color: colors.neutral[500],
    marginTop: 4,
  },
  sheetDate: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  modalScroll: {
    paddingHorizontal: spacing.xl,
  },
  filterLabel: {
    ...typography.overline,
    color: colors.neutral[500],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  chipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
  },
  chipText: {
    ...typography.smallMedium,
    color: colors.neutral[600],
  },
  chipTextActive: {
    color: colors.primary[700],
  },
  modalActions: {
    padding: spacing.xl,
  },
});
