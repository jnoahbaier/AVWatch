import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card } from '@/components/ui';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import {
  INCIDENT_TYPE_LABELS,
  AV_COMPANY_LABELS,
  REPORTER_TYPE_LABELS,
} from '@/lib/constants';
import { submitReport } from '@/lib/api';

type Step = 'type' | 'details' | 'review' | 'success';

const TYPE_ICONS: Record<string, string> = {
  collision: 'car-outline',
  near_miss: 'warning-outline',
  sudden_behavior: 'flash-outline',
  blockage: 'stop-circle-outline',
  other: 'help-circle-outline',
};

export default function ReportScreen() {
  const [step, setStep] = useState<Step>('type');
  const [submitting, setSubmitting] = useState(false);

  const [incidentType, setIncidentType] = useState('');
  const [company, setCompany] = useState('');
  const [reporterType, setReporterType] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const getLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to pin the incident.');
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: geo ? `${geo.street || ''} ${geo.city || ''}`.trim() : undefined,
      });
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    }
    setLocationLoading(false);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 3));
    }
  };

  const handleSubmit = async () => {
    if (!location) return;
    setSubmitting(true);
    try {
      const result = await submitReport({
        incident_type: incidentType,
        av_company: company || 'unknown',
        description: description || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        occurred_at: new Date(date).toISOString(),
        reporter_type: reporterType || undefined,
      });
      setReportId(result.id);
      setStep('success');
    } catch (err) {
      console.error('[ReportScreen] submitReport failed:', err);
      const message =
        err instanceof Error && err.message.includes('aborted')
          ? 'Request timed out. Please check your connection and try again.'
          : err instanceof Error && err.message.startsWith('API error:')
          ? `Server error: ${err.message}`
          : 'Could not submit your report. Please check your connection and try again.';
      Alert.alert('Submission failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('type');
    setIncidentType('');
    setCompany('');
    setReporterType('');
    setDescription('');
    setLocation(null);
    setPhotos([]);
    setReportId(null);
  };

  if (step === 'success') {
    const shortId = reportId ? `AVW-${reportId.slice(0, 8).toUpperCase()}` : null;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={colors.green[500]} />
          </View>
          <Text style={styles.successTitle}>Report Submitted</Text>
          <Text style={styles.successBody}>
            Thank you for helping keep our streets safe. Your report will be reviewed shortly.
          </Text>
          {shortId && (
            <View style={styles.reportIdBox}>
              <Text style={styles.reportIdLabel}>Report ID</Text>
              <Text style={styles.reportIdValue}>{shortId}</Text>
            </View>
          )}
          <Button title="Submit Another" onPress={reset} variant="outline" size="lg" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report Incident</Text>
          <View style={styles.stepIndicator}>
            {['type', 'details', 'review'].map((s, i) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  (step === s || ['type', 'details', 'review'].indexOf(step) > i) &&
                    styles.stepDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Type */}
          {step === 'type' && (
            <>
              <Text style={styles.question}>What happened?</Text>
              <View style={styles.optionGrid}>
                {Object.entries(INCIDENT_TYPE_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.optionCard,
                      incidentType === key && styles.optionCardActive,
                    ]}
                    onPress={() => setIncidentType(key)}
                  >
                    <Ionicons
                      name={(TYPE_ICONS[key] || 'help-circle-outline') as any}
                      size={28}
                      color={
                        incidentType === key
                          ? colors.primary[600]
                          : colors.neutral[400]
                      }
                    />
                    <Text
                      style={[
                        styles.optionLabel,
                        incidentType === key && styles.optionLabelActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.question, { marginTop: spacing.xl }]}>
                Which company?
              </Text>
              <View style={styles.chipRow}>
                {Object.entries(AV_COMPANY_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.chip,
                      company === key && styles.chipActive,
                    ]}
                    onPress={() => setCompany(key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        company === key && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.nextBtnWrap}>
                <Button
                  title="Continue"
                  onPress={() => setStep('details')}
                  disabled={!incidentType}
                  size="lg"
                />
              </View>
            </>
          )}

          {/* Step 2: Details */}
          {step === 'details' && (
            <>
              <Text style={styles.question}>Where did it happen?</Text>
              <TouchableOpacity style={styles.locationBtn} onPress={getLocation}>
                <Ionicons
                  name={location ? 'checkmark-circle' : 'locate-outline'}
                  size={20}
                  color={location ? colors.green[600] : colors.primary[600]}
                />
                <Text
                  style={[
                    styles.locationBtnText,
                    location && { color: colors.green[700] },
                  ]}
                >
                  {locationLoading
                    ? 'Getting location…'
                    : location
                    ? location.address || 'Location set'
                    : 'Use current location'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.question, { marginTop: spacing.xl }]}>
                When did it happen?
              </Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.neutral[300]}
              />

              <Text style={[styles.question, { marginTop: spacing.xl }]}>
                I was a…
              </Text>
              <View style={styles.chipRow}>
                {Object.entries(REPORTER_TYPE_LABELS).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.chip,
                      reporterType === key && styles.chipActive,
                    ]}
                    onPress={() => setReporterType(key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        reporterType === key && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.question, { marginTop: spacing.xl }]}>
                Description (optional)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe what happened…"
                placeholderTextColor={colors.neutral[300]}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Ionicons name="camera-outline" size={20} color={colors.primary[600]} />
                <Text style={styles.photoBtnText}>
                  {photos.length > 0
                    ? `${photos.length} photo(s) attached`
                    : 'Add photos'}
                </Text>
              </TouchableOpacity>

              <View style={styles.navRow}>
                <Button title="Back" onPress={() => setStep('type')} variant="outline" />
                <Button
                  title="Review"
                  onPress={() => setStep('review')}
                  disabled={!location}
                />
              </View>
            </>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <>
              <Text style={styles.question}>Review your report</Text>
              <Card style={styles.reviewCard}>
                <ReviewRow label="Type" value={INCIDENT_TYPE_LABELS[incidentType] || incidentType} />
                <ReviewRow label="Company" value={AV_COMPANY_LABELS[company] || company || '—'} />
                <ReviewRow label="Date" value={date} />
                <ReviewRow label="Location" value={location?.address || 'Set'} />
                <ReviewRow label="Role" value={REPORTER_TYPE_LABELS[reporterType] || '—'} />
                {description ? <ReviewRow label="Description" value={description} /> : null}
                <ReviewRow label="Photos" value={`${photos.length} attached`} />
              </Card>

              <View style={styles.navRow}>
                <Button
                  title="Back"
                  onPress={() => setStep('details')}
                  variant="outline"
                />
                <Button
                  title="Submit Report"
                  onPress={handleSubmit}
                  loading={submitting}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={reviewStyles.row}>
      <Text style={reviewStyles.label}>{label}</Text>
      <Text style={reviewStyles.value}>{value}</Text>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  label: {
    ...typography.small,
    color: colors.neutral[500],
  },
  value: {
    ...typography.smallMedium,
    color: colors.neutral[800],
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
  },
  stepDotActive: {
    backgroundColor: colors.primary[500],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 40,
  },
  question: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.md,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  optionCard: {
    width: '47%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionCardActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  optionLabel: {
    ...typography.smallMedium,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  optionLabelActive: {
    color: colors.primary[700],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
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
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
  },
  locationBtnText: {
    ...typography.bodyMedium,
    color: colors.primary[600],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    ...typography.body,
    color: colors.neutral[900],
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
  },
  photoBtnText: {
    ...typography.bodyMedium,
    color: colors.primary[600],
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing['2xl'],
  },
  nextBtnWrap: {
    marginTop: spacing['2xl'],
  },
  reviewCard: {
    marginBottom: spacing.lg,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.base,
  },
  successIcon: {
    marginBottom: spacing.base,
  },
  successTitle: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  successBody: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  reportIdBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: spacing.lg,
    gap: 4,
  },
  reportIdLabel: {
    ...typography.caption,
    color: colors.neutral[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reportIdValue: {
    ...typography.bodySemibold,
    color: colors.neutral[800],
    fontVariant: ['tabular-nums'],
  },
});
