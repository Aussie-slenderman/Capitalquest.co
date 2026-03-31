import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../src/store/useAppStore';
import { updateUser } from '../../src/services/auth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

export default function EmailEntryScreen() {
  const { user, setUser } = useAppStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleContinue = async () => {
    if (email.trim() && !isValidEmail(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      if (email.trim() && user?.id) {
        await updateUser(user.id, { notificationEmail: email.trim() });
        setUser({ ...user, notificationEmail: email.trim() } as typeof user);
      }
      setLoading(false);
      router.replace('/(auth)/setup');
    } catch {
      setError('Failed to save email. Please try again.');
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/setup');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <Text style={styles.emoji}>📧</Text>
          <Text style={styles.title}>Add Your Email</Text>
          <Text style={styles.subtitle}>
            Get weekly performance reports and important updates about your portfolio.
            This is optional — you can always add it later.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              placeholderTextColor={Colors.text.tertiary}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            disabled={loading}
          >
            <LinearGradient
              colors={[Colors.brand.primary, '#0096C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              <Text style={styles.continueBtnText}>
                {loading ? 'Saving...' : email.trim() ? 'Continue' : 'Continue Without Email'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            Your email is only used for performance reports. We never share it with third parties.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emoji: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
  },
  input: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
  },
  error: {
    color: Colors.market.loss,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  continueBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  continueGradient: {
    paddingVertical: Spacing.base,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  continueBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  skipBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  skipText: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
  },
  privacyNote: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 18,
  },
});
