import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '@/components/ui';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { supabase } from '@/lib/supabase';

type User = { email: string } | null;

export default function ProfileScreen() {
  const [user, setUser] = useState<User>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUser({ email: data.user.email });
      }
    });
  }, []);

  const signIn = async () => {
    if (!email || !supabase) {
      if (!supabase) Alert.alert('Not configured', 'Supabase is not set up yet.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your email', 'We sent you a magic link to sign in.');
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        {user ? (
          <>
            {/* User info */}
            <Card style={styles.userCard}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={28} color={colors.primary[600]} />
              </View>
              <Text style={styles.email}>{user.email}</Text>
            </Card>

            <MenuItem
              icon="document-text-outline"
              label="My Reports"
              onPress={() => {}}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => {}}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Data Sources & Privacy"
              onPress={() => {}}
            />
            <MenuItem
              icon="information-circle-outline"
              label="About AV Watch"
              onPress={() => {}}
            />

            <View style={styles.signOutWrap}>
              <Button
                title="Sign Out"
                onPress={signOut}
                variant="outline"
                size="md"
              />
            </View>
          </>
        ) : (
          <>
            {/* Guest state */}
            <Card style={styles.guestCard}>
              <View style={styles.guestIcon}>
                <Ionicons name="person-circle-outline" size={56} color={colors.neutral[300]} />
              </View>
              <Text style={styles.guestTitle}>Sign in to AV Watch</Text>
              <Text style={styles.guestBody}>
                Track your reports, get notified about incidents in your area, and contribute to community accountability.
              </Text>
            </Card>

            <View style={styles.authForm}>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.neutral[400]} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email address"
                  placeholderTextColor={colors.neutral[300]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Button
                title="Continue with Email"
                onPress={signIn}
                loading={loading}
                size="lg"
              />
            </View>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue as Guest"
              onPress={() => {}}
              variant="outline"
              size="lg"
            />

            <View style={styles.guestLinks}>
              <MenuItem
                icon="shield-checkmark-outline"
                label="Data Sources & Privacy"
                onPress={() => {}}
              />
              <MenuItem
                icon="information-circle-outline"
                label="About AV Watch"
                onPress={() => {}}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={menuStyles.row} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={colors.neutral[600]} />
      <Text style={menuStyles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.neutral[300]} />
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  label: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: spacing.base,
    marginBottom: spacing.xl,
  },
  userCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: {
    ...typography.bodySemibold,
    color: colors.neutral[800],
  },
  signOutWrap: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
  },
  guestCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  guestIcon: {
    marginBottom: spacing.sm,
  },
  guestTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  guestBody: {
    ...typography.small,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.base,
  },
  authForm: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    height: 50,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.neutral[900],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dividerText: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  guestLinks: {
    marginTop: spacing['2xl'],
  },
});
