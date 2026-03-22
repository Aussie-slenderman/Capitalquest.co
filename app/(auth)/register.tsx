import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { registerUser } from '../../src/services/auth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'Japan', 'France', 'Brazil', 'India', 'Other',
];

export default function RegisterScreen() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    username: '', displayName: '', country: 'United States',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleRegister = async () => {
    setError('');

    if (!form.displayName.trim()) { setError('Please enter your display name.'); return; }
    if (!form.username.trim()) { setError('Please enter a username.'); return; }
    if (form.username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    if (!form.password) { setError('Please enter a password.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await registerUser(
        form.email.trim(),
        form.password,
        form.username.trim().toLowerCase(),
        form.displayName.trim(),
        form.country,
      );
      router.replace('/(auth)/setup');
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message || 'Registration failed. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join thousands of virtual traders</Text>

        {/* Inline error banner — visible on all platforms */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Field label="Display Name" value={form.displayName}
            onChangeText={v => update('displayName', v)} placeholder="Theo Smales" />
          <Field label="Username" value={form.username}
            onChangeText={v => update('username', v.toLowerCase().replace(/\s/g, ''))}
            placeholder="theosmales" autoCapitalize="none" />
          <Field label="Email" value={form.email}
            onChangeText={v => update('email', v)} placeholder="theo@email.com"
            keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={form.password}
            onChangeText={v => update('password', v)} placeholder="Min. 6 characters"
            secureTextEntry />
          <Field label="Confirm Password" value={form.confirmPassword}
            onChangeText={v => update('confirmPassword', v)} placeholder="Re-enter password"
            secureTextEntry />

          {/* Country picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Country</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowCountryPicker(v => !v)}
            >
              <Text style={styles.pickerText}>{form.country}</Text>
              <Text style={styles.chevron}>{showCountryPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showCountryPicker && (
              <View style={styles.dropdown}>
                {COUNTRIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={styles.dropdownItem}
                    onPress={() => { update('country', c); setShowCountryPicker(false); }}
                  >
                    <Text style={[
                      styles.dropdownText,
                      form.country === c && styles.selectedText,
                    ]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.registerButton, loading && styles.disabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={loading
              ? [Colors.bg.tertiary, Colors.bg.tertiary]
              : [Colors.brand.primary, '#0096C7']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.registerText, loading && styles.loadingText]}>
              {loading ? 'Creating Account…' : 'Create Account'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By registering you agree to our Terms of Service and Privacy Policy.{'\n'}
          This app uses virtual money only — no real funds are involved.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.text.tertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { padding: Spacing['2xl'], paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: Spacing.lg },
  backText: { color: Colors.brand.primary, fontSize: FontSize.base },
  title: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold,
    color: Colors.text.primary, marginBottom: 6,
  },
  subtitle: {
    fontSize: FontSize.base, color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,61,87,0.12)',
    borderWidth: 1,
    borderColor: Colors.market.loss,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  errorIcon: { fontSize: 16 },
  errorText: {
    flex: 1,
    color: Colors.market.loss,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  form: { gap: Spacing.md, marginBottom: Spacing.xl },
  fieldContainer: { gap: 6 },
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
  pickerButton: {
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: { color: Colors.text.primary, fontSize: FontSize.base },
  chevron: { color: Colors.text.secondary, fontSize: FontSize.sm },
  dropdown: {
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  dropdownText: { color: Colors.text.primary, fontSize: FontSize.base },
  selectedText: { color: Colors.brand.primary, fontWeight: FontWeight.semibold },
  registerButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.base,
  },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  registerText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  loadingText: { color: Colors.text.secondary },
  disabled: { opacity: 0.7 },
  terms: {
    fontSize: FontSize.xs, color: Colors.text.tertiary,
    textAlign: 'center', lineHeight: 18,
  },
});
