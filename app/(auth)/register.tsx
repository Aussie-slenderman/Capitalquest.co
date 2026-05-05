import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
  FlatList, Modal, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { registerUser } from '../../src/services/auth';
import { setRegistrationInProgress } from '../_layout';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const ROOKIE_MARKETS_LOGO = require('../../assets/rookie-markets-logo.png');

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia',
  'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium',
  'Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
  'El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland',
  'France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea',
  'Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq',
  'Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait',
  'Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands',
  'Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro',
  'Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua',
  'Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine',
  'Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa',
  'San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone',
  'Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan',
  'Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia',
  'Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen',
  'Zambia','Zimbabwe',
];

export default function RegisterScreen() {
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
  });
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.toLowerCase().includes(q));
  }, [countrySearch]);

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleRegister = async () => {
    setError('');

    if (!form.username.trim()) { setError('Please enter a username.'); return; }
    if (form.username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!form.email.trim()) { setError('Please enter your email address.'); return; }
    if (!form.email.includes('@') || !form.email.includes('.')) { setError('Please enter a valid email address.'); return; }
    if (!country) { setError('Please select your country.'); return; }
    if (!form.password) { setError('Please enter a password.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const username = form.username.trim().toLowerCase();
      const email = form.email.trim().toLowerCase();

      // ── Server-side username moderation ─────────────────────────────
      // Use uniquely-named variables so the minifier can't accidentally
      // alias the response into another scope's variable. Treat anything
      // that isn't an explicit `ok: true` as a block (default-deny).
      let usernameValidationOk = false;
      let usernameValidationLabel = '';
      try {
        const validateFn = httpsCallable(getFunctions(), 'validateUsername');
        const validateResult = await validateFn({ username });
        const validateData = (validateResult && (validateResult as any).data) as
          | { ok?: boolean; categoryLabel?: string; matched?: string }
          | null
          | undefined;
        if (validateData && validateData.ok === true) {
          usernameValidationOk = true;
        } else {
          usernameValidationLabel = (validateData && validateData.categoryLabel) || 'community guidelines';
        }
      } catch (validateErr) {
        // Swallow into the default-deny path below.
        // eslint-disable-next-line no-console
        console.warn('validateUsername call failed:', validateErr);
      }
      if (!usernameValidationOk) {
        setError(
          usernameValidationLabel
            ? `Username not allowed (${usernameValidationLabel}). Please choose another.`
            : 'Could not validate username. Please try again in a moment.'
        );
        setLoading(false);
        return;
      }

      // Prevent auth listener from navigating during registration flow
      setRegistrationInProgress(true);
      await registerUser(
        username,
        form.password,
        username,
        country,
        email,
      );
      setLoading(false);
      // Send the player to the Terms of Service screen first; once they
      // tick the acceptance box and tap Continue, they'll be moved on
      // to /(auth)/setup to choose their starting balance.
      router.replace('/(auth)/terms' as any);
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message || 'Registration failed. Please try again.';
      setError(msg);
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
        contentContainerStyle={styles.scroll}
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

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join thousands of rookie traders learning the markets risk-free</Text>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Field label="Username" value={form.username}
            onChangeText={v => update('username', v.toLowerCase().replace(/\s/g, ''))}
            placeholder="johnathansmith" autoCapitalize="none" />

          {/* Username community-guideline notice — same categories as
              automated chat moderation. The validateUsername Cloud
              Function refuses any username that contains these. */}
          <View style={styles.usernameRules}>
            <Text style={styles.usernameRulesTitle}>Usernames must NOT contain:</Text>
            <Text style={styles.usernameRulesItem}>• Sexual or anatomical language</Text>
            <Text style={styles.usernameRulesItem}>• Profanity or swear words</Text>
            <Text style={styles.usernameRulesItem}>• Slurs or hateful language</Text>
            <Text style={styles.usernameRulesItem}>• Bullying terms (e.g. “loser”, “kys”)</Text>
            <Text style={styles.usernameRulesItem}>• Self-harm or suicide references</Text>
            <Text style={styles.usernameRulesFooter}>
              Accounts that break these rules are blocked at sign-up and can&apos;t be used.
            </Text>
          </View>

          <Field label="Email" value={form.email}
            onChangeText={v => update('email', v)}
            placeholder="your@email.com" autoCapitalize="none"
            keyboardType="email-address" />

          {/* Country Selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Country</Text>
            <TouchableOpacity
              style={styles.countrySelector}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={country ? styles.countrySelectorText : styles.countrySelectorPlaceholder}>
                {country || 'Select your country'}
              </Text>
              <Text style={styles.countrySelectorArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <Field label="Password" value={form.password}
            onChangeText={v => update('password', v)} placeholder="Min. 6 characters"
            secureTextEntry />
          <Field label="Confirm Password" value={form.confirmPassword}
            onChangeText={v => update('confirmPassword', v)} placeholder="Re-enter password"
            secureTextEntry />
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By registering you agree to our Terms of Service and Privacy Policy.{'\n'}
          This app uses virtual money only — no real funds are involved.
        </Text>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search countries..."
                placeholderTextColor={Colors.text.tertiary}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item}
              style={styles.countryList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, item === country && styles.countryItemSelected]}
                  onPress={() => {
                    setCountry(item);
                    setShowCountryPicker(false);
                    setCountrySearch('');
                    setError('');
                  }}
                >
                  <Text style={[styles.countryItemText, item === country && styles.countryItemTextSelected]}>
                    {item}
                  </Text>
                  {item === country && <Text style={styles.countryCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  scrollView: { flex: 1 },
  scroll: {
    padding: Spacing['2xl'],
    paddingTop: 40,
    paddingBottom: 60,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  back: { marginBottom: Spacing.lg },
  backText: { color: Colors.brand.primary, fontSize: FontSize.base },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  brandLogo: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  title: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold,
    color: Colors.text.primary, marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base, color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,61,87,0.12)',
    borderWidth: 1, borderColor: Colors.market.loss,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorIcon: { fontSize: 16 },
  errorText: {
    flex: 1, color: Colors.market.loss,
    fontSize: FontSize.sm, fontWeight: FontWeight.medium,
  },
  form: { gap: Spacing.md, marginBottom: Spacing.xl },
  usernameRules: {
    backgroundColor: Colors.bg.tertiary,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    marginTop: -Spacing.xs,
  },
  usernameRulesTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usernameRulesItem: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  usernameRulesFooter: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
  },
  fieldContainer: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text.secondary },
  input: {
    backgroundColor: Colors.bg.input, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border.default,
    color: Colors.text.primary, fontSize: FontSize.base,
  },

  // Country selector
  countrySelector: {
    backgroundColor: Colors.bg.input, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.border.default,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countrySelectorText: {
    color: Colors.text.primary, fontSize: FontSize.base,
  },
  countrySelectorPlaceholder: {
    color: Colors.text.tertiary, fontSize: FontSize.base,
  },
  countrySelectorArrow: {
    color: Colors.text.tertiary, fontSize: 12,
  },

  // Country picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border.default,
  },
  modalTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text.primary,
  },
  modalClose: {
    fontSize: 20, color: Colors.text.tertiary, padding: 4,
  },
  searchContainer: {
    padding: Spacing.base,
  },
  searchInput: {
    backgroundColor: Colors.bg.input, borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border.default,
    color: Colors.text.primary, fontSize: FontSize.base,
  },
  countryList: {
    maxHeight: 400,
  },
  countryItem: {
    paddingHorizontal: Spacing.base, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  countryItemSelected: {
    backgroundColor: 'rgba(0,179,230,0.1)',
  },
  countryItemText: {
    fontSize: FontSize.base, color: Colors.text.primary,
  },
  countryItemTextSelected: {
    color: Colors.brand.primary, fontWeight: FontWeight.semibold,
  },
  countryCheck: {
    color: Colors.brand.primary, fontSize: FontSize.lg, fontWeight: FontWeight.bold,
  },

  registerButton: {
    borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.base,
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
