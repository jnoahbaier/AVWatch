import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { useOnboarding } from '@/hooks/useOnboarding';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  const handleGetStarted = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Top hero area with gradient */}
      <LinearGradient
        colors={[colors.primary[50], colors.neutral[0]]}
        style={styles.heroGradient}
      >
        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <View style={styles.iconGrid}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="car-outline" size={32} color={colors.primary[600]} />
            </View>
            <View style={[styles.iconCircle, { backgroundColor: colors.green[100] }]}>
              <Ionicons name="shield-checkmark-outline" size={32} color={colors.green[600]} />
            </View>
            <View style={[styles.iconCircle, { backgroundColor: colors.orange[50] }]}>
              <Ionicons name="map-outline" size={32} color={colors.orange[600]} />
            </View>
            <View style={[styles.iconCircle, { backgroundColor: colors.purple[50] }]}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.purple[600]} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Bottom content */}
      <SafeAreaView edges={['bottom']} style={styles.bottomContent}>
        <View style={styles.textBlock}>
          <Text style={styles.title}>
            Track AV Incidents{'\n'}in Your City
          </Text>
          <Text style={styles.subtitle}>
            Report incidents, explore the map, and hold autonomous vehicle companies accountable — all in one place.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            size="lg"
            icon={<Ionicons name="chevron-forward" size={20} color="#fff" />}
          />
          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text
              style={styles.signInLink}
              onPress={() => {
                handleGetStarted();
              }}
            >
              Sign in
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  heroGradient: {
    height: height * 0.48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    width: 200,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
  },
  textBlock: {
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 40,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
    lineHeight: 24,
  },
  actions: {
    gap: spacing.base,
    alignItems: 'center',
  },
  signInText: {
    ...typography.small,
    color: colors.neutral[400],
  },
  signInLink: {
    color: colors.primary[600],
    fontWeight: '600',
  },
});
