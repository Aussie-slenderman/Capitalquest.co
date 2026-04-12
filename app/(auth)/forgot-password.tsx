import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { lookupUserByEmail } from '../../src/services/auth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

type Step = 'email' | 'code' | 'reset' | 'success';

// EmailJS config (same as email-settings.html)
const EJ_SERVICE = 'service_upj3ydy';
const EJ_OTP_TPL = 'template_4teeuzl';
const EJ_PUBLIC_KEY = 'lneCy8iqRXbKjHt2A';

async function sendOTPEmail(toEmail: string, code: string, toName: string) {
  // Use EmailJS REST API directly (no SDK import needed)
  const resp = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EJ_SERVICE,
      template_id: EJ_OTP_TPL,
      user_id: EJ_PUBLIC_KEY,
      template_params: {
        email: toEmail,
        passcode: code,
        time: new Date(Date.now() + 15 * 60_000).toLocaleTimeString(),
        to_name: toName || 'Player',
      },
    }),
  });
  if (!resp.ok) throw new Error('EmailJS failed: ' + resp.status);
}

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundUser, setFoundUser] = useState<Record<string, unknown> | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');

  // Step 1: Look up email, generate OTP, send via EmailJS
  const handleEmailSubmit = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!email.includes('@') || !email.includes('.')) { setError('Please enter a valid email.'); return; }

    setLoading(true);
    try {
      const user = await lookupUserByEmail(email.trim().toLowerCase());
      if (!user) {
        setError('No account found with that email address.');
        setLoading(false);
        return;
      }
      setFoundUser(user as Record<string, unknown>);

      // Generate 6-digit OTP (stored in local state only — no auth needed)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);

      // Send via EmailJS
      await sendOTPEmail(
        email.trim().toLowerCase(),
        code,
        (user as any).displayName || (user as any).username || 'Player',
      );

      setStep('code');
    } catch (e) {
      setError('Failed to send verification code. Please try again.');
    }
    setLoading(false);
  };

  // Step 2: Verify the 6-digit code
  const handleCodeSubmit = () => {
    setError('');
    if (codeInput.trim().length !== 6) { setError('Please enter the 6-digit code.'); return; }
    if (codeInput.trim() !== generatedCode) {
      setError('Incorrect code. Please check your email and try again.');
      return;
    }
    setStep('reset');
  };

  // Step 3: Save new password request
  const handleResetPassword = async () => {
    setError('');
    if (!newPassword) { setError('Please enter a new password.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!foundUser) { setError('User not found. Please go back.'); return; }

    setLoading(true);
    try {
      // Store the reset request in Firestore for server-side processing
      const firebase = await import('../../src/services/firebase');
      const { collection, addDoc } = await import('firebase/firestore');
      await addDoc(collection(firebase.db, 'passwordResetRequests'), {
        userId: (foundUser as any).id,
        email: (foundUser as any).email,
        newPassword,
        status: 'pending',
        createdAt: Date.now(),
      });
      setStep('success');
    } catch {
      setError('Failed to reset password. Please try again.');
    }
    setLoading(false);
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
        <TouchableOpacity
          onPress={() => {
            if (step === 'email') router.back();
            else if (step === 'code') setStep('email');
            else if (step === 'reset') setStep('code');
          }}
          style={styles.back}
        >
          <Text style={styles.backText}>{step === 'success' ? '' : '\u2190 Back'}</Text>
        </TouchableOpacity>

        {/* Step 1: Enter email */}
        {step === 'email' && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>Enter the email address linked to your account</Text>
            </View>
            {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{'\u26A0\uFE0F'}  {error}</Text></View>}
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={v => { setEmail(v); setError(''); }}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
            <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleEmailSubmit} disabled={loading}>
              <LinearGradient colors={[Colors.brand.primary, '#0096C7']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>{loading ? 'Sending Code...' : 'Send Verification Code'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Step 2: Enter 6-digit code */}
        {step === 'code' && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Enter Code</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit verification code to{'\n'}
                <Text style={{ color: Colors.brand.primary, fontWeight: FontWeight.bold }}>{email}</Text>
              </Text>
            </View>
            {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{'\u26A0\uFE0F'}  {error}</Text></View>}
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.input, { textAlign: 'center', fontSize: 28, letterSpacing: 12 }]}
                  value={codeInput}
                  onChangeText={v => { setCodeInput(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="000000"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleCodeSubmit}>
              <LinearGradient colors={[Colors.brand.primary, '#0096C7']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>Verify Code</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: Spacing.md }} onPress={handleEmailSubmit} disabled={loading}>
              <Text style={{ color: Colors.brand.primary, fontSize: FontSize.sm }}>
                {loading ? 'Resending...' : "Didn't get a code? Resend"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Step 3: Set new password */}
        {step === 'reset' && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.subtitle}>Account: @{foundUser?.username as string || ''}</Text>
            </View>
            {!!error && <View style={styles.errorBanner}><Text style={styles.errorText}>{'\u26A0\uFE0F'}  {error}</Text></View>}
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={v => { setNewPassword(v); setError(''); }}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.text.tertiary}
                  secureTextEntry
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={v => { setConfirmPassword(v); setError(''); }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.text.tertiary}
                  secureTextEntry
                />
              </View>
            </View>
            <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={handleResetPassword} disabled={loading}>
              <LinearGradient colors={[Colors.brand.primary, '#0096C7']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>{loading ? 'Resetting...' : 'Reset Password'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <View style={styles.successContainer}>
            <Text style={styles.successIcon}>{'\u2705'}</Text>
            <Text style={styles.title}>Password Reset Submitted!</Text>
            <Text style={styles.subtitle}>
              Your password reset is being processed.{'\n'}It will be updated within a few minutes.{'\n\n'}You can then sign in with your new password.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
              <LinearGradient colors={[Colors.brand.primary, '#0096C7']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>Back to Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scrollView: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing['2xl'], paddingTop: 100, paddingBottom: 60, justifyContent: 'center' },
  back: { position: 'absolute', top: 60, left: Spacing['2xl'] },
  backText: { color: Colors.brand.primary, fontSize: FontSize.base },
  header: { marginBottom: Spacing['2xl'] },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: { fontSize: FontSize.base, color: Colors.text.secondary, lineHeight: 22 },
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
  button: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.base },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  buttonText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  disabled: { opacity: 0.6 },
  successContainer: { alignItems: 'center', gap: Spacing.md },
  successIcon: { fontSize: 48, marginBottom: Spacing.md },
});
