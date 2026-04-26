/**
 * CapitalQuest — Test Email Blast Script
 *
 * One-off script triggered manually via GitHub Actions to either
 * COUNT or SEND a test email to all users who entered a real email.
 *
 * Modes (set via TEST_EMAIL_MODE env var):
 *   - "count" → only counts and reports recipients, sends nothing
 *   - "send"  → actually sends the test email
 *
 * Required environment variables (already set as GitHub Secrets):
 *   FIREBASE_SERVICE_ACCOUNT  — JSON string of Firebase admin SDK key
 *   RESEND_API_KEY            — Resend API key
 *   TEST_EMAIL_MODE           — "count" | "send"
 */

const admin = require('firebase-admin');
const { Resend } = require('resend');

const MODE = (process.env.TEST_EMAIL_MODE || 'count').toLowerCase();
if (MODE !== 'count' && MODE !== 'send') {
  console.error(`Invalid TEST_EMAIL_MODE: "${MODE}". Must be "count" or "send".`);
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'CapitalQuest <reports@capitalquest.co>';
const SUBJECT = 'Test Email from CapitalQuest';

const HTML_BODY = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>CapitalQuest Test</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0A0E1A; color: #F1F5F9; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #1E2940; border-radius: 12px; padding: 32px;">
    <h1 style="color: #00B3E6; margin: 0 0 16px;">📈 CapitalQuest</h1>
    <h2 style="color: #F1F5F9; margin: 0 0 16px; font-size: 18px;">Test email — delivery confirmed ✅</h2>
    <p style="color: #94A3B8; line-height: 1.6;">This is a test email sent via Resend from <code style="background: #1A2235; padding: 2px 6px; border-radius: 4px;">reports@capitalquest.co</code> to confirm the email pipeline is working.</p>
    <p style="color: #94A3B8; line-height: 1.6; margin-top: 24px;">If you received this, your Resend integration, DNS records, and domain verification are all functioning correctly. Weekly performance emails will arrive every Monday.</p>
    <hr style="border: none; border-top: 1px solid #1E2940; margin: 24px 0;"/>
    <p style="color: #64748B; font-size: 12px; margin: 0;">CapitalQuest · capitalquest.co</p>
  </div>
</body>
</html>`;

const TEXT_BODY = 'CapitalQuest test email — delivery confirmed.';

// Resend free tier rate limit: 10 req/sec. Use 150ms gap to stay safely under.
const SEND_DELAY_MS = 150;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`▶ Mode: ${MODE.toUpperCase()}`);
  console.log(`Fetching users from Firestore…`);

  const usersSnap = await db.collection('users').get();
  console.log(`Total user docs: ${usersSnap.size}`);

  // Build deduplicated recipient list
  const recipients = new Set();
  let skippedFake = 0, skippedNoEmail = 0;

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    const candidate = user.notificationEmail || user.userEmail || user.email;
    if (!candidate) { skippedNoEmail++; continue; }
    if (candidate.endsWith('@capitalquest.app')) { skippedFake++; continue; }
    recipients.add(candidate.toLowerCase().trim());
  }

  console.log(`\n📊 Recipient summary:`);
  console.log(`   Eligible (real emails, deduplicated): ${recipients.size}`);
  console.log(`   Skipped (no email):                   ${skippedNoEmail}`);
  console.log(`   Skipped (fake @capitalquest.app):     ${skippedFake}`);
  console.log(`   Total user docs:                      ${usersSnap.size}`);

  if (MODE === 'count') {
    console.log(`\n✓ COUNT MODE — no emails sent. Re-run with mode="send" to actually send.`);
    return;
  }

  // SEND MODE
  if (recipients.size > 2900) {
    console.error(`\n⚠ STOPPING: ${recipients.size} recipients exceeds Resend free-tier safety threshold (2,900).`);
    console.error(`   Free tier is 3,000 emails/month. Sending this many would exhaust it and break weekly emails.`);
    console.error(`   Either upgrade Resend tier or reduce recipients.`);
    process.exit(1);
  }

  console.log(`\n🚀 SEND MODE — sending test email to ${recipients.size} recipients…\n`);

  let sent = 0, errors = 0;
  const errorLog = [];

  for (const to of recipients) {
    try {
      const result = await resend.emails.send({
        from: FROM,
        to,
        subject: SUBJECT,
        html: HTML_BODY,
        text: TEXT_BODY,
      });
      if (result.error) {
        errors++;
        errorLog.push({ to, error: result.error.message || JSON.stringify(result.error) });
        console.error(`✗ ${to} — ${result.error.message || 'unknown error'}`);
      } else {
        sent++;
        if (sent % 25 === 0) {
          console.log(`… progress: ${sent}/${recipients.size} sent`);
        }
      }
    } catch (err) {
      errors++;
      errorLog.push({ to, error: err.message });
      console.error(`✗ ${to} — ${err.message}`);
    }
    await sleep(SEND_DELAY_MS);
  }

  console.log(`\n📨 Done — ${sent} sent, ${errors} errors`);
  if (errors > 0) {
    console.log(`\nFirst 10 errors:`);
    errorLog.slice(0, 10).forEach(e => console.log(`  ${e.to}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
