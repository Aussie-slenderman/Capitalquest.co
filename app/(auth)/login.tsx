import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { loginUser } from '../../src/services/auth';
import { setLoginInProgress } from '../_layout';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const ROOKIE_MARKETS_LOGO = require('../../assets/rookie-markets-logo.png');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!username.trim()) { setError('Please enter your username.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    // Prevent the auth listener from redirecting to welcome during sign-in
    setLoginInProgress(true);
    try {
      await loginUser(username.trim().toLowerCase(), password);
      // Navigate immediately to dashboard. The auth listener will still fire
      // and load user data / portfolio in the background.
      router.replace('/(app)/dashboard');
    } catch (e: unknown) {
      setLoginInProgress(false);
      setError((e as { message?: string }).message || 'Invalid username or password.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, Platform.OS === 'web' && { height: '100vh' as any }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.brand}>
          <Image
            source={ROOKIE_MARKETS_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Rookie Markets"
          />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Rookie Markets account</Text>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️  {error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="your_username"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="default"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.text.tertiary}
              secureTextEntry
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.disabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <LinearGradient
            colors={[Colors.brand.primary, '#0096C7']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.loginText}>{loading ? 'Signing In...' : 'Sign In'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          <Text style={styles.forgotLinkText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.registerLinkText}>
            Don't have an account? <Text style={styles.linkAccent}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scrollView: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing['2xl'],
    paddingTop: 80,
    paddingBottom: 60,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  back: { position: 'absolute', top: 24, left: Spacing['2xl'] },
  backText: { color: Colors.brand.primary, fontSize: FontSize.base },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  brandLogo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  form: { gap: Spacing.base, marginBottom: Spacing.xl },
  field: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  input: {
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
    color: Colors.text.primary,
    fontSize: FontSize.base,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,61,87,0.12)',
    borderWidth: 1,
    borderColor: '#FF3D57',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  errorText: { color: '#FF3D57', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  loginButton: { borderRadius: Radius.lg, overflow: 'hidden' },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  loginText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  disabled: { opacity: 0.6 },
  forgotLink: { marginTop: Spacing.lg, alignItems: 'center' },
  forgotLinkText: { fontSize: FontSize.sm, color: Colors.brand.primary, fontWeight: FontWeight.semibold },
  registerLink: { marginTop: Spacing.base, alignItems: 'center' },
  registerLinkText: { fontSize: FontSize.base, color: Colors.text.secondary },
  linkAccent: { color: Colors.brand.primary, fontWeight: FontWeight.semibold },
});
