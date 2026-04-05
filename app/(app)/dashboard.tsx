import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, SafeAreaView, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ALL_NEWS } from './notifications';
import Sidebar from '../../src/components/Sidebar';
import AppHeader from '../../src/components/AppHeader';
import { useAppStore } from '../../src/store/useAppStore';
import { updateUser } from '../../src/services/auth';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { useT } from '../../src/constants/translations';


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

export default function DashboardScreen() {
  const {
    user, setUser,
    notifications, newsLastRead,
    portfolio, isSidebarOpen, setSidebarOpen, appTabColors, appColorMode,
    showWelcomePopup, setShowWelcomePopup,
  } = useAppStore();
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const t = useT();

  // Country picker state
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return ALL_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return ALL_COUNTRIES.filter(c => c.toLowerCase().includes(q));
  }, [countrySearch]);

  const handleSelectCountry = async (country: string) => {
    if (!user) return;
    try {
      await updateUser(user.id, { country });
      setUser({ ...user, country });
      setShowCountryPicker(false);
    } catch {}
  };

  const needsCountry = user && (!user.country || user.country === '' || user.country === 'Unknown');

  // Dismisses the welcome popup and marks it as permanently shown in the DB
  function handleDismissWelcome() {
    setShowWelcomePopup(false);
    if (user) {
      updateUser(user.id, { welcomeShown: true }).catch(() => {});
      setUser({ ...user, welcomeShown: true });
    }
  }

  const tabColor = appTabColors["home"] ?? Colors.brand.primary;

  const unreadNotifications = useMemo(() => {
    const heldSymbols = portfolio?.holdings.map(h => h.symbol) ?? [];
    const hasUnreadHoldingsNews = heldSymbols.length > 0 &&
      ALL_NEWS.some(n =>
        n.relatedSymbols.some(s => heldSymbols.includes(s)) && n.publishedAt > newsLastRead
      );
    return notifications.filter(n => !n.read).length + (hasUnreadHoldingsNews ? 1 : 0);
  }, [notifications, portfolio, newsLastRead]);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: C.bg.primary }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg.primary} />

        {/* ── Top bar ── */}
        <AppHeader title="CapitalQuest" />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Country notification banner ── */}
          {needsCountry && (
            <TouchableOpacity
              style={{
                backgroundColor: '#F5C51822',
                borderWidth: 1,
                borderColor: '#F5C51855',
                borderRadius: 12,
                padding: 14,
                marginHorizontal: Spacing.base,
                marginBottom: Spacing.base,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
              onPress={() => setShowCountryPicker(true)}
            >
              <Text style={{ fontSize: 24 }}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F5C518', fontWeight: '700', fontSize: 14 }}>Set Your Country</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Required for local leaderboard rankings</Text>
              </View>
              <Text style={{ color: '#F5C518', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          )}

          {/* ── Hero slogan ── */}
          <LinearGradient
            colors={[`${tabColor}22`, `${tabColor}08`, "transparent"] as any}
            style={styles.heroSection}
          >
            <Text style={[styles.heroSlogan, { color: C.text.primary }]}>{t('practice')}</Text>
            <Text style={[styles.heroSlogan, { color: C.text.primary }]}>{t('trade_word')}</Text>
            <Text style={[styles.heroSlogan, { color: tabColor }]}>{t('prosper')}</Text>
            <Text style={[styles.heroSubtitle, { color: C.text.secondary }]}>
              {t('hero_subtitle')}
            </Text>

            {/* Quick action buttons */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickBtn, { borderColor: tabColor }]}
                onPress={() => router.push('/(app)/home' as never)}
              >
                <Text style={styles.quickBtnIcon}>📊</Text>
                <Text style={[styles.quickBtnText, { color: tabColor }]}>{t('markets')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickBtn, { borderColor: Colors.brand.accent }]}
                onPress={() => router.push('/(app)/portfolio' as never)}
              >
                <Text style={styles.quickBtnIcon}>💼</Text>
                <Text style={[styles.quickBtnText, { color: Colors.brand.accent }]}>{t('portfolio')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickBtn, { borderColor: Colors.brand.gold }]}
                onPress={() => router.push('/(app)/leaderboard' as never)}
              >
                <Text style={styles.quickBtnIcon}>🏆</Text>
                <Text style={[styles.quickBtnText, { color: Colors.brand.gold }]}>{t('rankings')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

        </ScrollView>
      </SafeAreaView>

      <Sidebar visible={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── One-time Welcome Popup ── */}
      <Modal
        visible={showWelcomePopup}
        animationType="fade"
        transparent
        onRequestClose={handleDismissWelcome}
      >
        <View style={styles.welcomeOverlay}>
          <LinearGradient
            colors={['#0A1228', '#111827']}
            style={styles.welcomeCard}
          >
            {/* Gold glow ring */}
            <View style={styles.welcomeIconRing}>
              <Text style={styles.welcomeIconEmoji}>🎉</Text>
            </View>

            <Text style={styles.welcomeTitle}>Congratulations!</Text>

            <Text style={styles.welcomeBody}>
              You have now created your{' '}
              <Text style={styles.welcomeBrand}>CapitalQuest</Text>{' '}
              account and have been awarded{' '}
              <Text style={styles.welcomeMoney}>$10,000</Text>{' '}
              virtual dollars.
            </Text>

            <Text style={styles.welcomeFun}>Have Fun!!! 🚀</Text>

            <TouchableOpacity
              style={styles.welcomeBtn}
              onPress={handleDismissWelcome}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.brand.primary, Colors.brand.accent]}
                style={styles.welcomeBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.welcomeBtnText}>Let's Trade! 📈</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 40 }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#1E2940' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', marginBottom: 12 }}>🌍 Select Your Country</Text>
              <TextInput
                style={{ backgroundColor: '#1A2235', borderRadius: 12, padding: 12, fontSize: 15, color: '#F1F5F9', borderWidth: 1, borderColor: '#1E2940' }}
                placeholder="Search countries..."
                placeholderTextColor="#64748B"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1A2235' }}
                  onPress={() => handleSelectCountry(item)}
                >
                  <Text style={{ fontSize: 15, color: '#F1F5F9' }}>{item}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
            <TouchableOpacity
              style={{ margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1E2940', alignItems: 'center' }}
              onPress={() => setShowCountryPicker(false)}
            >
              <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.bg.primary },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.brand.primary,
    letterSpacing: 0.4,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconText: { fontSize: 22 },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.market.loss,
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },
  hamburger: { gap: 4, alignItems: 'flex-end' },
  hLine: {
    width: 20,
    height: 2,
    backgroundColor: Colors.text.secondary,
    borderRadius: 2,
  },

  // Scroll
  scroll:   { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing.base },

  // Hero
  heroSection: {
    flex: 1,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  heroSlogan: {
    fontSize: 42,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    letterSpacing: -1.5,
    lineHeight: 50,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 22,
    maxWidth: 280,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    width: '100%',
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
    minWidth: 0,
  },
  quickBtnIcon: { fontSize: 22 },
  quickBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // ── Welcome popup ──
  welcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  welcomeCard: {
    width: '100%',
    borderRadius: Radius.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.brand.gold + '60',
    shadowColor: Colors.brand.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  welcomeIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.brand.gold + '22',
    borderWidth: 2,
    borderColor: Colors.brand.gold + '66',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  welcomeIconEmoji: { fontSize: 44 },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  welcomeBody: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  welcomeBrand: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.bold,
  },
  welcomeMoney: {
    color: Colors.market.gain,
    fontWeight: FontWeight.extrabold,
  },
  welcomeFun: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.brand.gold,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  welcomeBtn: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: Colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  welcomeBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  welcomeBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
