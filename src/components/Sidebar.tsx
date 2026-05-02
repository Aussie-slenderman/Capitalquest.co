import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../store/useAppStore';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import { formatAccountNumber } from '../utils/formatters';
import { LANGUAGES, useT } from '../constants/translations';
import { updateUser, signOut, deleteAccount } from '../services/auth';
import type { AvatarConfig } from '../types';

const SIDEBAR_WIDTH = 300;

// ─── OTP delivery ─────────────────────────────────────────────────────────
// Calls the sendOtpEmail Cloud Function (server-side Resend) instead of
// the previous client-side EmailJS API. Resend uses the verified
// reports@capitalquest.co sender, has 3000 free emails/month vs EmailJS's
// 200, and gives us proper error responses. EmailJS's "200 status =
// success" was hiding silent delivery failures for some recipients
// (school email systems, corporate inboxes, etc.).
async function sendOTPEmail(toEmail: string, code: string, toName: string) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions();
  const fn = httpsCallable(fns, 'sendOtpEmail');
  await fn({ email: toEmail, code, toName: toName || 'Player' });
}

const ACCENT_COLORS = [
  { label: 'Sky Blue',   color: '#00B3E6' },
  { label: 'Emerald',    color: '#00D4AA' },
  { label: 'Purple',     color: '#7C3AED' },
  { label: 'Rose',       color: '#EC4899' },
  { label: 'Gold',       color: '#F5C518' },
  { label: 'Orange',     color: '#F59E0B' },
  { label: 'Lime',       color: '#22C55E' },
  { label: 'Red',        color: '#EF4444' },
  { label: 'Indigo',     color: '#6366F1' },
  { label: 'Cyan',       color: '#06B6D4' },
  { label: 'White',      color: '#F1F5F9' },
  { label: 'Coral',      color: '#FF6B6B' },
];

const TAB_COLOR_OPTIONS = [
  { label: 'Social',  tab: 'social',      defaultColor: '#EC4899', icon: '💬' },
  { label: 'Trade',   tab: 'trade',       defaultColor: '#00C853', icon: '📊' },
  { label: 'Profile', tab: 'profile',     defaultColor: '#7C3AED', icon: '👤' },
];

const WARDROBE_ANIMALS = [
  '🐶','🐱','🐻','🐼','🦊','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
  '🐔','🐧','🐦','🦅','🦉','🐴','🦄','🐲','🐙','🦋','🐢','🐬',
  '🦈','🐠','🦜','🦩','🐺','🦝','🐹','🐰',
];

const WARDROBE_COLORS = [
  '#FF6B6B','#F59E0B','#22C55E','#00B3E6','#7C3AED','#EC4899',
  '#00D4AA','#6366F1','#F5C518','#EF4444','#06B6D4','#FF6B6B',
  '#1A2235','#111827','#0A0E1A','#334155',
];

// ─── Sidebar Component ────────────────────────────────────────────────────────

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const t = useT();

  const {
    user, setUser,
    appColorMode, setAppColorMode,
    appAccentColor, setAppAccentColor,
    appTileStyle, setAppTileStyle,
    appTabColors, setAppTabColor,
    appLanguage, setAppLanguage,
  } = useAppStore();

  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;

  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [wardrobeVisible, setWardrobeVisible] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState(user?.avatarConfig?.animal ?? '🐶');
  const [selectedBgColor, setSelectedBgColor] = useState(user?.avatarConfig?.bgColor ?? Colors.bg.tertiary);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailStep, setEmailStep] = useState<'enter' | 'verify'>('enter');
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeInput, setEmailCodeInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const filteredLangs = useMemo(() => {
    if (!langSearch.trim()) return LANGUAGES;
    const q = langSearch.toLowerCase();
    return LANGUAGES.filter(l =>
      l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q)
    );
  }, [langSearch]);
  const currentLang = LANGUAGES.find(l => l.code === appLanguage) ?? LANGUAGES[0];

  const ALL_COUNTRIES = [
    "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan",
    "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
    "Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic",
    "Denmark","Djibouti","Dominica","Dominican Republic",
    "East Timor","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
    "Fiji","Finland","France",
    "Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
    "Haiti","Honduras","Hungary",
    "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Ivory Coast",
    "Jamaica","Japan","Jordan",
    "Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan",
    "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
    "Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
    "Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway",
    "Oman",
    "Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
    "Qatar",
    "Romania","Russia","Rwanda",
    "Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
    "Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
    "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
    "Vanuatu","Vatican City","Venezuela","Vietnam",
    "Yemen",
    "Zambia","Zimbabwe",
  ];
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return ALL_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return ALL_COUNTRIES.filter(c => c.toLowerCase().includes(q));
  }, [countrySearch]);

  const handleSelectCountry = async (country: string) => {
    if (!user) return;
    setUser({ ...user, country });
    setCountryPickerVisible(false);
    setCountrySearch('');
    try { await updateUser(user.id, { country }); } catch {}
  };

  const handleSaveAvatar = async () => {
    if (!user) return;
    const newConfig: AvatarConfig = { animal: selectedAnimal, bgColor: selectedBgColor };
    setUser({ ...user, avatarConfig: newConfig });
    setWardrobeVisible(false);
    try { await updateUser(user.id, { avatarConfig: newConfig }); } catch {}
  };

  // Step 1: Send 6-digit verification code to the entered email
  const handleSendEmailCode = async () => {
    if (!user || !emailInput.trim()) return;
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setEmailSending(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setEmailCode(code);
      await sendOTPEmail(trimmed, code, user.displayName || user.username || 'Player');
      setEmailStep('verify');
    } catch {
      setEmailError('Failed to send code. Please try again.');
    }
    setEmailSending(false);
  };

  // Step 2: Verify the code and save the email
  const handleVerifyEmailCode = async () => {
    if (!user) return;
    if (emailCodeInput.trim() !== emailCode) {
      setEmailError('Incorrect code. Please try again.');
      return;
    }
    const trimmed = emailInput.trim().toLowerCase();
    // Update userEmail and notificationEmail but NOT 'email' —
    // 'email' is the Firebase Auth email used for login and must not be changed
    setUser({ ...user, userEmail: trimmed, notificationEmail: trimmed });
    setEmailModalVisible(false);
    setEmailInput('');
    setEmailCodeInput('');
    setEmailStep('enter');
    setEmailCode('');
    setEmailError('');
    try {
      await updateUser(user.id, {
        userEmail: trimmed,
        notificationEmail: trimmed,
        emailVerified: true,
      });
    } catch {}
  };

  // Reset email modal state when closing
  const handleCloseEmailModal = () => {
    setEmailModalVisible(false);
    setEmailInput('');
    setEmailCodeInput('');
    setEmailStep('enter');
    setEmailCode('');
    setEmailError('');
    setEmailSending(false);
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    const trimmed = usernameInput.trim().toLowerCase().replace(/\s/g, '');
    if (trimmed.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameError('Only letters, numbers, and underscores');
      return;
    }
    if (trimmed === user.username) {
      setUsernameModalVisible(false);
      return;
    }
    setUsernameError('');
    setUser({ ...user, username: trimmed, displayName: trimmed });
    setUsernameModalVisible(false);
    setUsernameInput('');
    try { await updateUser(user.id, { username: trimmed, displayName: trimmed }); } catch {}
  };

  // ─── Slide animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SIDEBAR_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateX, overlayOpacity]);

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sidebar Panel */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: C.bg.secondary,
            borderLeftColor: C.border.default,
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* Close Button */}
        <View style={[styles.closeRow, { borderBottomColor: C.border.default }]}>
          <Text style={[styles.sidebarHeading, { color: C.text.primary }]}>Settings</Text>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.closeBtnText, { color: C.text.secondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing['2xl'] }}
        >
          {/* ── User Profile ── */}
          <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
            {user?.avatarConfig ? (
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: user.avatarConfig.bgColor ?? Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.brand.primary }}>
                <Text style={{ fontSize: 32 }}>{user.avatarConfig.animal ?? '🐶'}</Text>
              </View>
            ) : (
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.brand.primary + '33', borderWidth: 2, borderColor: Colors.brand.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: FontWeight.bold, color: Colors.brand.primary }}>{(user?.username ?? '?')[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary, marginTop: Spacing.sm }}>{user?.displayName ?? '—'}</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.text.secondary }}>@{user?.username ?? '—'}</Text>
          </View>

          {/* ── Wardrobe Button ── */}
          <TouchableOpacity
            style={[styles.wardrobeBtn, { backgroundColor: Colors.brand.accent }]}
            onPress={() => setWardrobeVisible(true)}
          >
            <Text style={{ fontSize: 18 }}>👕</Text>
            <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold }}>{t('wardrobe')}</Text>
          </TouchableOpacity>

          {/* ── Add Email Button ── */}
          <TouchableOpacity
            style={[styles.emailBtn, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}
            onPress={() => { setEmailInput((user as any)?.userEmail || ''); setEmailModalVisible(true); }}
          >
            <Text style={{ fontSize: 18 }}>✉️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary }}>
                {(user as any)?.userEmail ? (user as any).userEmail : 'Add Email'}
              </Text>
              {!(user as any)?.userEmail && (
                <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 1 }}>Link an email to your account</Text>
              )}
            </View>
            <Text style={{ fontSize: 12, color: C.text.tertiary }}>▶</Text>
          </TouchableOpacity>

          {/* ── Change Username Button ── */}
          <TouchableOpacity
            style={[styles.emailBtn, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}
            onPress={() => { setUsernameInput(user?.username ?? ''); setUsernameError(''); setUsernameModalVisible(true); }}
          >
            <Text style={{ fontSize: 18 }}>✏️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary }}>
                Change Username
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 1 }}>@{user?.username ?? '—'}</Text>
            </View>
            <Text style={{ fontSize: 12, color: C.text.tertiary }}>▶</Text>
          </TouchableOpacity>

          {/* ── Change Country Button ── */}
          <TouchableOpacity
            style={[styles.emailBtn, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}
            onPress={() => { setCountrySearch(''); setCountryPickerVisible(true); }}
          >
            <Text style={{ fontSize: 18 }}>🌍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary }}>
                Change Country
              </Text>
              <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 1 }}>{user?.country || 'Not set'}</Text>
            </View>
            <Text style={{ fontSize: 12, color: C.text.tertiary }}>▶</Text>
          </TouchableOpacity>

          {/* ── Account Number ── */}
          <View style={[styles.settingsSection, { borderTopColor: C.border.default }]}>
            <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('account_number')}</Text>
            <View style={[styles.accountRow, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}>
              <Text style={{ fontSize: FontSize.base, color: C.text.secondary }}>
                {user ? formatAccountNumber(user.accountNumber) : '—'}
              </Text>
            </View>
          </View>

          {/* ── Language ── */}
          <TouchableOpacity
            style={[styles.langBtn, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}
            onPress={() => setLangPickerVisible(true)}
          >
            <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.medium, color: C.text.primary }}>🌐  {t('language')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: FontSize.base, color: Colors.brand.primary, fontWeight: FontWeight.semibold }}>{currentLang.nativeName}</Text>
              <Text style={{ fontSize: 12, color: C.text.tertiary }}>▶</Text>
            </View>
          </TouchableOpacity>

          {/* ── Appearance Settings ── */}
          <View style={[styles.settingsSection, { borderTopColor: C.border.default }]}>
            <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('appearance')}</Text>

            {/* Dark / Light Mode */}
            <Text style={[styles.settingsSubhead, { color: C.text.secondary }]}>{t('mode')}</Text>
            <View style={[styles.modeRow, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}>
              <TouchableOpacity
                style={[styles.modeBtn, appColorMode === 'dark' && { backgroundColor: appAccentColor }]}
                onPress={() => setAppColorMode('dark')}
              >
                <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: appColorMode === 'dark' ? '#fff' : C.text.primary }}>{`🌑  ${t('dark')}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, appColorMode === 'light' && { backgroundColor: appAccentColor }]}
                onPress={() => setAppColorMode('light')}
              >
                <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: appColorMode === 'light' ? '#fff' : C.text.primary }}>{`☀️  ${t('light')}`}</Text>
              </TouchableOpacity>
            </View>

            {/* Accent Colour */}
            <Text style={[styles.settingsSubhead, { color: C.text.secondary }]}>{t('accent_colour')}</Text>
            <View style={styles.colorGrid}>
              {ACCENT_COLORS.map(({ label, color }) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    appAccentColor === color && styles.colorSwatchActive,
                  ]}
                  onPress={() => {
                    setAppAccentColor(color);
                    // Apply accent color to all tab backgrounds
                    ['home', 'social', 'trade', 'profile', 'leaderboard', 'advisor', 'shop', 'trophy-road'].forEach(tab => setAppTabColor(tab, color));
                  }}
                >
                  {appAccentColor === color && <Text style={{ color: '#fff', fontSize: 16, fontWeight: FontWeight.bold }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>

            {/* Reset */}
            <TouchableOpacity
              style={[styles.resetBtn, { borderColor: C.border.default }]}
              onPress={() => {
                setAppColorMode('dark');
                setAppAccentColor('#00B3E6');
                setAppTileStyle('default');
                TAB_COLOR_OPTIONS.forEach(({ tab, defaultColor }) => setAppTabColor(tab, defaultColor));
              }}
            >
              <Text style={[styles.resetText, { color: C.text.tertiary }]}>{`↺  ${t('reset_defaults')}`}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Sign Out & Delete Account ── */}
          <View style={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.lg, gap: Spacing.sm }}>
            <TouchableOpacity
              style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' }}
              onPress={async () => {
                const confirmed = Platform.OS === 'web'
                  ? window.confirm('Are you sure you want to sign out?')
                  : true;
                if (confirmed) {
                  onClose();
                  await signOut();
                  setUser(null);
                  router.replace('/(auth)/welcome');
                }
              }}
            >
              <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold }}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: Colors.market.loss + '22', borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.market.loss }}
              onPress={async () => {
                const confirmed = Platform.OS === 'web'
                  ? window.confirm('Are you sure you want to delete your account? This cannot be undone.')
                  : false;
                if (confirmed && user?.id) {
                  onClose();
                  await deleteAccount(user.id);
                  setUser(null);
                  router.replace('/(auth)/welcome');
                }
              }}
            >
              <Text style={{ color: Colors.market.loss, fontSize: FontSize.base, fontWeight: FontWeight.bold }}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── Language Picker Modal ── */}
      <Modal visible={langPickerVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 40 }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: C.border.default }}>
              <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary }}>{t('select_language')}</Text>
            </View>
            <TextInput
              style={{ marginHorizontal: 20, marginVertical: 10, backgroundColor: C.bg.tertiary, borderRadius: 12, padding: 12, fontSize: 15, color: C.text.primary, borderWidth: 1, borderColor: C.border.default }}
              placeholder={t('search_languages')}
              placeholderTextColor={C.text.tertiary}
              value={langSearch}
              onChangeText={setLangSearch}
            />
            <FlatList
              data={filteredLangs}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ paddingHorizontal: Spacing.base, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border.default, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...(item.code === appLanguage ? { backgroundColor: 'rgba(0,179,230,0.1)' } : {}) }}
                  onPress={() => { setAppLanguage(item.code); setLangPickerVisible(false); setLangSearch(''); }}
                >
                  <View>
                    <Text style={{ fontSize: FontSize.base, color: item.code === appLanguage ? Colors.brand.primary : C.text.primary, fontWeight: item.code === appLanguage ? FontWeight.semibold : FontWeight.regular }}>
                      {item.nativeName}
                    </Text>
                    <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 2 }}>{item.name}</Text>
                  </View>
                  {item.code === appLanguage && <Text style={{ color: Colors.brand.primary, fontSize: FontSize.lg, fontWeight: FontWeight.bold }}>✓</Text>}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
            <TouchableOpacity
              style={{ margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border.default, alignItems: 'center' }}
              onPress={() => { setLangPickerVisible(false); setLangSearch(''); }}
            >
              <Text style={{ color: C.text.tertiary, fontWeight: FontWeight.semibold }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Wardrobe Modal ── */}
      <Modal visible={wardrobeVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg.secondary, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '85%', paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: C.border.default }}>
              <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary }}>{`👕 ${t('wardrobe')}`}</Text>
              <TouchableOpacity onPress={() => setWardrobeVisible(false)}>
                <Text style={{ fontSize: 20, color: C.text.tertiary, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: Spacing.base }} showsVerticalScrollIndicator={false}>
              {/* Preview */}
              <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: selectedBgColor, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.brand.primary }}>
                  <Text style={{ fontSize: 44 }}>{selectedAnimal}</Text>
                </View>
                <Text style={{ color: C.text.secondary, fontSize: FontSize.sm, marginTop: Spacing.sm }}>{t('preview')}</Text>
              </View>
              {/* Animal Selection */}
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary, marginBottom: Spacing.sm }}>{t('choose_animal')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg }}>
                {WARDROBE_ANIMALS.map(animal => (
                  <TouchableOpacity
                    key={animal}
                    onPress={() => setSelectedAnimal(animal)}
                    style={{
                      width: 48, height: 48, borderRadius: Radius.md,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: animal === selectedAnimal ? Colors.brand.primary + '22' : C.bg.tertiary,
                      borderWidth: animal === selectedAnimal ? 2 : 1,
                      borderColor: animal === selectedAnimal ? Colors.brand.primary : C.border.default,
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>{animal}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Background Color */}
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary, marginBottom: Spacing.sm }}>{t('background_colour')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl }}>
                {WARDROBE_COLORS.map((color, i) => (
                  <TouchableOpacity
                    key={color + i}
                    onPress={() => setSelectedBgColor(color)}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: color,
                      borderWidth: color === selectedBgColor ? 3 : 1,
                      borderColor: color === selectedBgColor ? Colors.brand.primary : C.border.default,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {color === selectedBgColor && <Text style={{ color: '#fff', fontSize: 16, fontWeight: FontWeight.bold }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
              {/* Save */}
              <TouchableOpacity
                style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.base }}
                onPress={handleSaveAvatar}
              >
                <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold }}>{t('save')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Email Modal (2-step verification) ── */}
      <Modal visible={emailModalVisible} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl }}>
          <View style={{ width: '100%', backgroundColor: C.bg.secondary, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: C.border.default }}>

            {emailStep === 'enter' ? (
              <>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary, marginBottom: Spacing.md }}>✉️  Add Email</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.text.secondary, marginBottom: Spacing.md }}>
                  We'll send a 6-digit verification code to confirm this email.
                </Text>
                <TextInput
                  style={{ backgroundColor: C.bg.tertiary, borderRadius: Radius.md, padding: 14, fontSize: FontSize.base, color: C.text.primary, borderWidth: 1, borderColor: emailError ? Colors.market.loss : C.border.default, marginBottom: emailError ? 4 : Spacing.md }}
                  placeholder="your@email.com"
                  placeholderTextColor={C.text.tertiary}
                  value={emailInput}
                  onChangeText={(t) => { setEmailInput(t); setEmailError(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {emailError ? (
                  <Text style={{ fontSize: FontSize.xs, color: Colors.market.loss, marginBottom: Spacing.sm }}>{emailError}</Text>
                ) : null}
                <TouchableOpacity
                  style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm, opacity: emailSending ? 0.6 : 1 }}
                  onPress={handleSendEmailCode}
                  disabled={emailSending}
                >
                  <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold }}>
                    {emailSending ? 'Sending Code...' : 'Send Verification Code'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary, marginBottom: Spacing.md }}>🔐  Enter Code</Text>
                <Text style={{ fontSize: FontSize.sm, color: C.text.secondary, marginBottom: Spacing.md }}>
                  A 6-digit code was sent to {emailInput.trim().toLowerCase()}. Enter it below.
                </Text>
                <TextInput
                  style={{ backgroundColor: C.bg.tertiary, borderRadius: Radius.md, padding: 14, fontSize: 24, color: C.text.primary, borderWidth: 1, borderColor: emailError ? Colors.market.loss : C.border.default, marginBottom: emailError ? 4 : Spacing.md, textAlign: 'center', letterSpacing: 8 }}
                  placeholder="000000"
                  placeholderTextColor={C.text.tertiary}
                  value={emailCodeInput}
                  onChangeText={(t) => { setEmailCodeInput(t.replace(/[^0-9]/g, '').slice(0, 6)); setEmailError(''); }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {emailError ? (
                  <Text style={{ fontSize: FontSize.xs, color: Colors.market.loss, marginBottom: Spacing.sm }}>{emailError}</Text>
                ) : null}
                <TouchableOpacity
                  style={{ backgroundColor: Colors.market.gain, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm }}
                  onPress={handleVerifyEmailCode}
                >
                  <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold }}>Verify & Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingVertical: 8, alignItems: 'center', marginBottom: 4 }}
                  onPress={handleSendEmailCode}
                  disabled={emailSending}
                >
                  <Text style={{ color: Colors.brand.primary, fontWeight: FontWeight.semibold, fontSize: FontSize.sm }}>
                    {emailSending ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: 'center' }}
              onPress={handleCloseEmailModal}
            >
              <Text style={{ color: C.text.tertiary, fontWeight: FontWeight.semibold }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* ── Change Username Modal ── */}
      <Modal visible={usernameModalVisible} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl }}>
          <View style={{ width: '100%', backgroundColor: C.bg.secondary, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: C.border.default }}>
            <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary, marginBottom: Spacing.md }}>✏️  Change Username</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.text.secondary, marginBottom: Spacing.md }}>Your username appears in rankings, friends, and clubs.</Text>
            <TextInput
              style={{ backgroundColor: C.bg.tertiary, borderRadius: Radius.md, padding: 14, fontSize: FontSize.base, color: C.text.primary, borderWidth: 1, borderColor: usernameError ? Colors.market.loss : C.border.default, marginBottom: usernameError ? 4 : Spacing.md }}
              placeholder="new_username"
              placeholderTextColor={C.text.tertiary}
              value={usernameInput}
              onChangeText={(t) => { setUsernameInput(t.toLowerCase().replace(/\s/g, '')); setUsernameError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {usernameError ? (
              <Text style={{ fontSize: FontSize.xs, color: Colors.market.loss, marginBottom: Spacing.sm }}>{usernameError}</Text>
            ) : null}
            <TouchableOpacity
              style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm }}
              onPress={handleSaveUsername}
            >
              <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold }}>Save Username</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: 'center' }}
              onPress={() => { setUsernameModalVisible(false); setUsernameInput(''); setUsernameError(''); }}
            >
              <Text style={{ color: C.text.tertiary, fontWeight: FontWeight.semibold }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Change Country Modal ── */}
      <Modal visible={countryPickerVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: C.border.default }}>
              <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary, textAlign: 'center', marginBottom: 12 }}>🌍 Select Your Country</Text>
              <TextInput
                style={{ backgroundColor: C.bg.tertiary, borderRadius: 12, padding: 12, fontSize: 15, color: C.text.primary, borderWidth: 1, borderColor: C.border.default }}
                placeholder="Search countries..."
                placeholderTextColor={C.text.tertiary}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
            </View>
            <ScrollView style={{ flexGrow: 0 }} nestedScrollEnabled>
              {filteredCountries.map((country) => {
                const isSelected = country === user?.country;
                if (Platform.OS === 'web') {
                  return (
                    <div key={country} style={{ paddingTop: 14, paddingBottom: 14, paddingLeft: 20, paddingRight: 20, borderBottom: '1px solid ' + C.border.default, cursor: 'pointer', backgroundColor: isSelected ? 'rgba(0,179,230,0.1)' : 'transparent' }} onClick={() => handleSelectCountry(country)}>
                      <Text style={{ fontSize: 15, color: isSelected ? Colors.brand.primary : C.text.primary, fontWeight: isSelected ? FontWeight.semibold : FontWeight.regular }}>{country}</Text>
                    </div>
                  );
                }
                return (
                  <TouchableOpacity key={country} style={{ paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border.default, backgroundColor: isSelected ? 'rgba(0,179,230,0.1)' : 'transparent' }} onPress={() => handleSelectCountry(country)}>
                    <Text style={{ fontSize: 15, color: isSelected ? Colors.brand.primary : C.text.primary, fontWeight: isSelected ? FontWeight.semibold : FontWeight.regular }}>{country}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={{ margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border.default, alignItems: 'center' }}
              onPress={() => { setCountryPickerVisible(false); setCountrySearch(''); }}
            >
              <Text style={{ color: C.text.tertiary, fontWeight: FontWeight.semibold }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 9998,
    elevation: 9998,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.bg.secondary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border.default,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },

  // Header
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  sidebarHeading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  closeBtnText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Settings sections
  settingsSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  settingsSubhead: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Account number
  accountRow: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
  },

  // Wardrobe button
  wardrobeBtn: {
    marginHorizontal: Spacing.base,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },

  // Email button
  emailBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    gap: 10,
  },

  // Language button
  langBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
  },

  // Mode toggle
  modeRow: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Color grid
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  // Reset
  resetBtn: {
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
