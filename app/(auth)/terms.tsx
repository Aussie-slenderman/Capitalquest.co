import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const TERMS_TEXT = `Terms of Service for Capital Quest – Stock Investment Simulator (Ages 10–15)

1. Introduction
Welcome to Capital Quest! This app is a stock investment simulator designed for educational purposes only. It allows users to learn about investing by using virtual money, not real money. By using this app, you agree to follow these Terms of Service.

2. Eligibility
This app is intended for users between the ages of 10 and 15. If you are under 10, you must have permission from a parent or guardian before using the app. By using Capital Quest, you confirm that you meet these age requirements or have appropriate permission.

3. Educational Purpose Only
Capital Quest is designed to help users understand how stock markets work. All trading is simulated, and no real money is used or earned. The app provides light financial guidance to support learning, but this should not be considered full or professional financial advice.

4. Non-Certified Educational Content
The lessons, tips, and information provided in Capital Quest are not created or reviewed by certified teachers, financial advisors, or licensed professionals. They are meant to offer basic, limited guidance to help users get familiar with investing concepts.

Users should not rely entirely on the information provided in the app. Capital Quest is only a starting point for learning, and players should not base real-world trading or financial decisions solely on the information given within the app. Users are encouraged to explore additional trusted resources and seek guidance from qualified professionals where appropriate.

5. User Accounts
You may need to create an account to use certain features. You agree to:

• Provide accurate information
• Keep your login details private
• Not share your account with others

We may suspend or delete accounts that break these rules.

6. Virtual Currency and Gameplay

• All money used in the app is virtual and has no real-world value.
• You cannot withdraw, transfer, or exchange virtual money for real money.
• Progress, scores, and rankings are part of the learning experience and may be reset or adjusted.

7. Safe and Respectful Use
Users must:

• Be respectful to others
• Not use harmful, offensive, or inappropriate language
• Not attempt to cheat, hack, or disrupt the app
• Choose appropriate and respectful usernames

This policy applies to all content within the app, including usernames. Admins and moderators reserve the full right to remove or delete accounts that contain offensive, inappropriate, or harmful usernames or behavior.

8. Privacy and Data
We take your privacy seriously. We only collect necessary information to run the app and improve your experience.

9. No Financial Risk and Limited Advice
Because this is a simulation:

• You cannot lose or gain real money
• The app is not responsible for real-world financial decisions made by users

While the app may provide light financial guidance, users should not base any real-world financial or trading decisions solely on the information provided in Capital Quest.

10. Updates and Changes
We may update the app or these Terms of Service at any time to improve safety and functionality. Continued use of the app means you accept any changes.

11. Ending Use
You can stop using the app at any time. We may also suspend or terminate accounts that violate these terms.

12. Contact
If you have questions or concerns, please contact us at: capitalquest.co@gmail.com

Summary (Kid-Friendly Version):
Capital Quest is a learning game where you use fake money to understand stocks. The advice in the app is basic and not from professional teachers, so don't rely on it for real-life decisions. Always ask a parent if you're under 10, be kind (even in your username), and remember — it's just a game, not real investing!`;

export default function TermsScreen() {
  const [accepted, setAccepted] = useState(false);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0E1A', '#111827', '#0A0E1A']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Text style={styles.headerIcon}>📜</Text>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <Text style={styles.headerSubtitle}>Please read and accept to continue</Text>
      </View>

      <View style={styles.termsContainer}>
        <ScrollView
          style={styles.termsScroll}
          contentContainerStyle={styles.termsContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.termsText}>{TERMS_TEXT}</Text>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAccepted(!accepted)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and agree to the Terms of Service
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueBtn, !accepted && styles.continueBtnDisabled]}
          onPress={() => {
            if (accepted) {
              router.replace('/(auth)/email-entry');
            }
          }}
          disabled={!accepted}
        >
          <LinearGradient
            colors={accepted ? [Colors.brand.primary, '#0096C7'] : ['#333', '#333']}
            style={styles.continueBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.continueBtnText, !accepted && { color: Colors.text.tertiary }]}>
              Continue
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 40 : 60,
    paddingBottom: Spacing.base,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  termsContainer: {
    flex: 1,
    marginHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.secondary,
    overflow: 'hidden',
  },
  termsScroll: {
    flex: 1,
  },
  termsContent: {
    padding: Spacing.base,
  },
  termsText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  footer: {
    padding: Spacing.base,
    paddingBottom: Platform.OS === 'web' ? Spacing.xl : 40,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    gap: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  continueBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
