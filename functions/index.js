const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { Resend } = require('resend');

admin.initializeApp();

// Lazy-init the Resend client so deploys without RESEND_API_KEY still
// load the module without throwing.
let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY || functions.config().resend?.api_key;
  if (!key) throw new functions.https.HttpsError('failed-precondition', 'RESEND_API_KEY is not configured');
  _resend = new Resend(key);
  return _resend;
}

const DAILY_SNAPSHOT_TIMEZONE = 'America/New_York';
const DAILY_SNAPSHOT_CRON = '5 21 * * *'; // 9:05 PM ET, after market close

// Allowed admin emails
const ADMIN_EMAILS = ['theosmales1@gmail.com'];

/**
 * deleteUserAccount — callable function
 * Fully removes a user from Firebase Auth AND all Firestore collections
 * so the username can be immediately re-registered.
 *
 * Called with: { uid: string }
 */
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  // Must be authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  // Must be an admin
  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorised.');
  }

  const uid = data.uid;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }

  const db = admin.firestore();
  const auth = admin.auth();

  // 1. Delete Firebase Auth account (frees the username@capitalquest.app email)
  try {
    await auth.deleteUser(uid);
  } catch (e) {
    // User may not exist in Auth — continue anyway to clean Firestore
    console.warn('Auth delete skipped:', e.message);
  }

  // 2. Delete notifications subcollection (must be done before the user doc)
  try {
    const notifs = await db.collection('users').doc(uid).collection('notifications').get();
    const notifDeletes = notifs.docs.map(d => d.ref.delete());
    await Promise.all(notifDeletes);
  } catch (e) {
    console.warn('Notifications delete skipped:', e.message);
  }

  // 3. Delete transactions (query-based, can exceed batch limit so delete individually)
  try {
    const txns = await db.collection('transactions').where('userId', '==', uid).get();
    const txnDeletes = txns.docs.map(d => d.ref.delete());
    await Promise.all(txnDeletes);
  } catch (e) {
    console.warn('Transactions delete skipped:', e.message);
  }

  // 4. Batch-delete all top-level docs for this user
  const batch = db.batch();
  batch.delete(db.collection('users').doc(uid));
  batch.delete(db.collection('portfolios').doc(uid));
  batch.delete(db.collection('leaderboard').doc(uid));
  await batch.commit();

  console.log(`deleteUserAccount: fully deleted uid=${uid}`);
  return { success: true };
});

/**
 * adminResetPassword — callable function
 * Admin-only. Sets a new Firebase Auth password for `uid` so the player
 * can log in with it immediately. Clears any legacy adminTempPassword
 * fields on the user doc.
 *
 * Called with: { uid: string, newPassword: string }
 */
exports.adminResetPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorised.');
  }

  const uid = data && data.uid;
  const newPassword = data && data.newPassword;
  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'newPassword must be at least 6 characters.'
    );
  }

  // 1. Update Firebase Auth password — this is what the player will
  //    actually use to sign in.
  await admin.auth().updateUser(uid, { password: newPassword });

  // 2. Clear the old adminTempPassword fields (no longer used) and stamp
  //    a reset timestamp so the dashboard / audits know when this happened.
  try {
    await admin.firestore().collection('users').doc(uid).update({
      adminTempPassword: admin.firestore.FieldValue.delete(),
      adminTempPasswordSetAt: admin.firestore.FieldValue.delete(),
      adminPasswordResetAt: Date.now(),
      adminPasswordResetBy: callerEmail,
    });
  } catch (e) {
    console.warn('adminResetPassword: user doc update skipped:', e.message);
  }

  console.log(`adminResetPassword: uid=${uid} by ${callerEmail}`);
  return { success: true };
});

/**
 * adminResetUsername — callable function
 * Admin-only. Renames a player's username (and displayName so the UI
 * mirrors it). The login flow looks up the Firebase Auth email by
 * username, so after this call the player can sign in with the new
 * username and their existing password.
 *
 * Called with: { uid: string, newUsername: string }
 */
exports.adminResetUsername = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorised.');
  }

  const uid = data && data.uid;
  const rawUsername = data && data.newUsername;
  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  if (!rawUsername || typeof rawUsername !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'newUsername is required.');
  }
  const newUsername = rawUsername.trim().toLowerCase().replace(/\s+/g, '');
  if (newUsername.length < 3 || newUsername.length > 20) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Username must be 3–20 characters.'
    );
  }
  if (!/^[a-z0-9_]+$/.test(newUsername)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Username may only contain lowercase letters, numbers, and underscores.'
    );
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }

  // Username uniqueness is not enforced in this app (per CLAUDE.md), so
  // no collision check is needed. We still mirror the new username into
  // displayName so dashboard / leaderboard labels follow.
  await userRef.update({
    username: newUsername,
    displayName: newUsername,
    adminUsernameResetAt: Date.now(),
    adminUsernameResetBy: callerEmail,
  });

  console.log(`adminResetUsername: uid=${uid} -> @${newUsername} by ${callerEmail}`);
  return { success: true, newUsername };
});

/**
 * sendOtpEmail — public callable function (no auth required)
 * Sends a 6-digit verification code to `email` via Resend. This replaces
 * the client-side EmailJS call that was used by the "Add email" sidebar
 * action and the forgot-password flow. EmailJS's free tier is 200/month
 * and silently fails for many provider/recipient combinations (school
 * email systems, corporate inboxes, etc.); Resend's verified domain has
 * far better deliverability and 3000/month free.
 *
 * Called with: { email, code, toName }
 *   - email   : recipient address (string, must contain "@")
 *   - code    : the 6-digit OTP the client generated and stored locally
 *   - toName  : optional display name shown in the email body
 *
 * Per-IP rate limit: max 5 OTPs per email address per 10 minutes
 * (tracked in Firestore otpRateLimit/{emailLowercase}). Prevents abuse
 * of an unauthenticated function.
 */
exports.sendOtpEmail = functions.https.onCall(async (data, context) => {
  const rawEmail = data && data.email;
  const code = data && data.code;
  const toName = (data && data.toName) || 'Player';

  if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.includes('@') || !rawEmail.includes('.')) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid email is required.');
  }
  if (!code || typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
    throw new functions.https.HttpsError('invalid-argument', '4–8 digit numeric code is required.');
  }

  const email = rawEmail.trim().toLowerCase();

  // ── Rate limit: 5 sends / 10 minutes per email ─────────────────────
  const db = admin.firestore();
  const limitDoc = db.collection('otpRateLimit').doc(email.replace(/[^a-z0-9._-]/g, '_'));
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  try {
    const snap = await limitDoc.get();
    const data = snap.exists ? snap.data() : {};
    const sends = (data.sends || []).filter((t) => now - t < windowMs);
    if (sends.length >= 5) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many verification codes requested for this email. Please wait a few minutes.'
      );
    }
    sends.push(now);
    await limitDoc.set({ sends, lastEmail: email }, { merge: true });
  } catch (err) {
    if (err && err.code === 'resource-exhausted') throw err;
    // Non-fatal: don't block sending if Firestore rate-limit write fails.
    console.warn('sendOtpEmail: rate-limit check skipped:', err.message);
  }

  // ── Build & send email ─────────────────────────────────────────────
  const expiresAt = new Date(now + 15 * 60_000).toLocaleTimeString();
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rookie Markets verification</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0E1A;color:#F1F5F9;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#111827;border:1px solid #1E2940;border-radius:16px;padding:32px;">
    <h1 style="color:#00B3E6;margin:0 0 8px;font-size:20px;">📈 Rookie Markets</h1>
    <h2 style="color:#F1F5F9;margin:0 0 16px;font-size:18px;">Hey ${escapeHtml(toName)},</h2>
    <p style="color:#94A3B8;line-height:1.6;margin:0 0 16px;">Use this 6-digit code to verify your email on Rookie Markets:</p>
    <div style="background:#1A2235;border:1px solid #1E2940;border-radius:12px;padding:18px;text-align:center;margin:0 0 16px;">
      <div style="font-size:36px;font-weight:800;letter-spacing:6px;color:#00B3E6;font-family:'SF Mono','Menlo',monospace;">${code}</div>
    </div>
    <p style="color:#64748B;font-size:13px;line-height:1.6;margin:0 0 8px;">This code expires at <strong>${expiresAt}</strong>.</p>
    <p style="color:#64748B;font-size:13px;line-height:1.6;margin:0;">If you didn't request this, you can safely ignore this email.</p>
    <hr style="border:none;border-top:1px solid #1E2940;margin:24px 0;"/>
    <p style="color:#475569;font-size:11px;margin:0;">Rookie Markets · Virtual stock trading · No real money involved</p>
  </div>
</body>
</html>`;

  const text = `Rookie Markets verification code\n\nHey ${toName},\n\nYour 6-digit code is: ${code}\n\nThis code expires at ${expiresAt}. If you didn't request this, ignore this email.\n\n— Rookie Markets`;

  try {
    const result = await getResend().emails.send({
      from: 'Rookie Markets <reports@capitalquest.co>',
      to: email,
      subject: `Your Rookie Markets verification code: ${code}`,
      html,
      text,
    });
    if (result && result.error) {
      console.error('sendOtpEmail Resend error:', JSON.stringify(result.error));
      throw new functions.https.HttpsError('internal', `Resend rejected: ${result.error.message || 'unknown'}`);
    }
    const id = result && result.data && result.data.id;
    console.log(`sendOtpEmail: queued for ${email} id=${id}`);
    return { success: true, messageId: id || null };
  } catch (err) {
    if (err && err.code && typeof err.code === 'string' && err.code.startsWith('functions/')) throw err;
    console.error('sendOtpEmail failed:', err && err.message);
    throw new functions.https.HttpsError('internal', `Failed to send verification email: ${err && err.message ? err.message : 'unknown'}`);
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * reportPlayer — authenticated callable
 * Lets a player report another player. Sends a formatted email to the
 * moderation inbox (rookiemarkets@gmail.com) and stores a record in
 * Firestore `reports/` for audit.
 *
 * Called with: {
 *   reportedUid:       string,           // UID of reported player
 *   reportedUsername:  string,           // username of reported player
 *   reason:            'sexual_hateful' | 'scamming' | 'harassment'
 *                    | 'spam' | 'other',
 *   details:           string,           // free-text description
 *   context:           'friend' | 'club' | 'chat' | 'unknown',
 *   clubName?:         string,           // when context === 'club'
 *   chatMessage?:      string,           // when context === 'chat'
 *   chatRoomId?:       string,           // when context === 'chat'
 * }
 *
 * Per-reporter rate limit: max 10 reports / 1 hour.
 */
const REPORT_REASON_LABELS = {
  sexual_hateful: 'Sexual or hateful comment',
  scamming: 'Scamming',
  harassment: 'Harassment / bullying',
  spam: 'Spam / unwanted messages',
  other: 'Other',
};

exports.reportPlayer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to report a player.');
  }
  const reporterUid = context.auth.uid;
  const reporterEmail = (context.auth.token.email || '').toLowerCase();

  const reportedUid = data && data.reportedUid;
  const reportedUsername = data && data.reportedUsername;
  const reason = data && data.reason;
  const details = (data && typeof data.details === 'string') ? data.details.trim().slice(0, 2000) : '';
  const ctx = (data && data.context) || 'unknown';
  const clubName = (data && typeof data.clubName === 'string') ? data.clubName.trim().slice(0, 100) : '';
  const chatMessage = (data && typeof data.chatMessage === 'string') ? data.chatMessage.trim().slice(0, 1000) : '';
  const chatRoomId = (data && typeof data.chatRoomId === 'string') ? data.chatRoomId.slice(0, 200) : '';

  if (!reportedUid || typeof reportedUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'reportedUid is required.');
  }
  if (!reportedUsername || typeof reportedUsername !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'reportedUsername is required.');
  }
  if (!reason || !REPORT_REASON_LABELS[reason]) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid reason is required.');
  }
  if (reportedUid === reporterUid) {
    throw new functions.https.HttpsError('invalid-argument', 'You cannot report yourself.');
  }

  const db = admin.firestore();

  // ── Rate limit: max 10 reports / 1 hour per reporter ───────────────
  const now = Date.now();
  const limitDoc = db.collection('reportRateLimit').doc(reporterUid);
  try {
    const snap = await limitDoc.get();
    const rl = snap.exists ? (snap.data() || {}) : {};
    const recent = (rl.sends || []).filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length >= 10) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Too many reports submitted recently. Please try again later.'
      );
    }
    recent.push(now);
    await limitDoc.set({ sends: recent }, { merge: true });
  } catch (err) {
    if (err && err.code === 'resource-exhausted') throw err;
    console.warn('reportPlayer: rate-limit check skipped:', err && err.message);
  }

  // ── Look up reporter's username for the email ──────────────────────
  let reporterUsername = '';
  let reporterDisplayName = '';
  let reporterNotificationEmail = '';
  try {
    const rDoc = await db.collection('users').doc(reporterUid).get();
    if (rDoc.exists) {
      const rd = rDoc.data() || {};
      reporterUsername = rd.username || '';
      reporterDisplayName = rd.displayName || rd.username || '';
      reporterNotificationEmail = rd.notificationEmail || '';
    }
  } catch (e) { /* non-fatal */ }

  const reasonLabel = REPORT_REASON_LABELS[reason];
  const submittedAt = new Date(now).toISOString();

  // ── Persist to Firestore for audit ─────────────────────────────────
  const reportRef = db.collection('reports').doc();
  const reportRecord = {
    id: reportRef.id,
    reportedUid,
    reportedUsername,
    reporterUid,
    reporterUsername,
    reporterEmail,
    reporterNotificationEmail,
    reason,
    reasonLabel,
    details,
    context: ctx,
    clubName: clubName || null,
    chatMessage: chatMessage || null,
    chatRoomId: chatRoomId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'open',
  };
  try { await reportRef.set(reportRecord); } catch (e) {
    console.warn('reportPlayer: Firestore write failed:', e && e.message);
  }

  // ── Build context-specific email sections ──────────────────────────
  const ctxLabel = ctx === 'friend' ? 'Friends list'
                 : ctx === 'club'   ? `Club roster${clubName ? ` — “${clubName}”` : ''}`
                 : ctx === 'chat'   ? 'Chat message'
                 : 'Unknown';

  let reasonExtraHtml = '';
  let reasonExtraText = '';
  if (reason === 'sexual_hateful' || reason === 'harassment') {
    reasonExtraHtml += `<p style="margin:0 0 6px;color:#94A3B8;font-size:13px;"><strong style="color:#F1F5F9;">⚠️ Action priority:</strong> High — possible community-guideline violation.</p>`;
    reasonExtraText += `\nAction priority: High — possible community-guideline violation.`;
  }
  if (reason === 'scamming') {
    reasonExtraHtml += `<p style="margin:0 0 6px;color:#94A3B8;font-size:13px;"><strong style="color:#F1F5F9;">💰 Action priority:</strong> Investigate trade proposals & friend interactions involving the reported user.</p>`;
    reasonExtraText += `\nAction priority: Investigate trade proposals & friend interactions involving the reported user.`;
  }
  if (reason === 'spam') {
    reasonExtraHtml += `<p style="margin:0 0 6px;color:#94A3B8;font-size:13px;"><strong style="color:#F1F5F9;">📨 Action priority:</strong> Review chat history for repeated/unsolicited messages.</p>`;
    reasonExtraText += `\nAction priority: Review chat history for repeated/unsolicited messages.`;
  }

  const chatBlockHtml = chatMessage
    ? `<div style="background:#1A2235;border:1px solid #1E2940;border-radius:12px;padding:14px;margin:8px 0 16px;">
         <div style="color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Reported message</div>
         <div style="color:#F1F5F9;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(chatMessage)}</div>
         ${chatRoomId ? `<div style="color:#475569;font-size:11px;margin-top:8px;">room: ${escapeHtml(chatRoomId)}</div>` : ''}
       </div>` : '';
  const chatBlockText = chatMessage
    ? `\n\n--- Reported message ---\n${chatMessage}${chatRoomId ? `\n(room: ${chatRoomId})` : ''}\n------------------------\n` : '';

  const detailsBlockHtml = details
    ? `<div style="background:#1A2235;border:1px solid #1E2940;border-radius:12px;padding:14px;margin:8px 0 16px;">
         <div style="color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Reporter's details</div>
         <div style="color:#F1F5F9;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(details)}</div>
       </div>` : '<p style="color:#64748B;font-size:13px;margin:0 0 16px;"><em>No additional details provided.</em></p>';
  const detailsBlockText = details
    ? `\n\nReporter's details:\n${details}` : '\n\nNo additional details provided.';

  const subject = `[Report] @${reportedUsername} — ${reasonLabel}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0E1A;color:#F1F5F9;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1E2940;border-radius:16px;padding:32px;">
    <h1 style="color:#FF3D57;margin:0 0 4px;font-size:18px;">🚩 New Player Report</h1>
    <p style="color:#64748B;font-size:12px;margin:0 0 20px;">Submitted ${submittedAt}</p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;">
      <tr><td style="padding:6px 0;color:#94A3B8;width:130px;">Reported player</td><td style="padding:6px 0;color:#F1F5F9;font-weight:700;">@${escapeHtml(reportedUsername)}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Reported UID</td><td style="padding:6px 0;color:#F1F5F9;font-family:'SF Mono','Menlo',monospace;font-size:12px;">${escapeHtml(reportedUid)}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Reason</td><td style="padding:6px 0;color:#F5C518;font-weight:700;">${escapeHtml(reasonLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Where reported</td><td style="padding:6px 0;color:#F1F5F9;">${escapeHtml(ctxLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Reporter</td><td style="padding:6px 0;color:#F1F5F9;">@${escapeHtml(reporterUsername || '(unknown)')} <span style="color:#64748B;font-size:12px;">(${escapeHtml(reporterEmail || '—')})</span></td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">Reporter UID</td><td style="padding:6px 0;color:#F1F5F9;font-family:'SF Mono','Menlo',monospace;font-size:12px;">${escapeHtml(reporterUid)}</td></tr>
    </table>

    ${reasonExtraHtml}
    ${chatBlockHtml}
    ${detailsBlockHtml}

    <hr style="border:none;border-top:1px solid #1E2940;margin:20px 0;"/>
    <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0 0 6px;">Report ID: <code style="color:#94A3B8;">${reportRef.id}</code></p>
    <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0;">Open the admin dashboard to review the reported account: <a href="https://capitalquest.co/admin-dashboard.html" style="color:#00B3E6;">admin-dashboard.html</a></p>
  </div>
</body></html>`;

  const text = `New Player Report
Submitted ${submittedAt}

Reported player:    @${reportedUsername}  (uid: ${reportedUid})
Reason:             ${reasonLabel}
Where reported:     ${ctxLabel}
Reporter:           @${reporterUsername || '(unknown)'} (${reporterEmail || '—'}) (uid: ${reporterUid})
${reasonExtraText}${chatBlockText}${detailsBlockText}

Report ID: ${reportRef.id}
Admin dashboard: https://capitalquest.co/admin-dashboard.html
`;

  try {
    const sendPayload = {
      from: 'Rookie Markets Reports <reports@capitalquest.co>',
      to: 'rookiemarkets@gmail.com',
      subject,
      html,
      text,
    };
    // Only include reply_to when we actually have an address; some SDK
    // versions reject `undefined` fields with a validation error.
    if (reporterNotificationEmail && reporterNotificationEmail.includes('@')) {
      sendPayload.reply_to = reporterNotificationEmail;
    }
    const result = await getResend().emails.send(sendPayload);
    if (result && result.error) {
      console.error('reportPlayer Resend error:', JSON.stringify(result.error));
      throw new functions.https.HttpsError('internal', `Resend rejected: ${result.error.message || 'unknown'}`);
    }
    const id = result && result.data && result.data.id;
    console.log(`reportPlayer: ${reason} report by ${reporterUid} for ${reportedUid} sent (msg=${id || '?'} reportId=${reportRef.id})`);
    return { success: true, reportId: reportRef.id };
  } catch (err) {
    if (err && err.code && typeof err.code === 'string' && err.code.startsWith('functions/')) throw err;
    console.error('reportPlayer failed:', err && err.message);
    throw new functions.https.HttpsError('internal', `Failed to send report: ${err && err.message ? err.message : 'unknown'}`);
  }
});

/**
 * bootstrapAdmin — public callable (idempotent, hardcoded target)
 * Ensures the Firebase Auth user `theosmales1@gmail.com` exists with the
 * password used by moderator-login.html, so moderator sign-in works on a
 * fresh install. Safe to call repeatedly: creates the user if missing,
 * updates the password if it already exists. Operates ONLY on the
 * hardcoded admin email — never any other account — so it is safe to
 * leave callable without auth.
 */
exports.bootstrapAdmin = functions.https.onCall(async (data, context) => {
  const ADMIN_EMAIL = 'theosmales1@gmail.com';
  const ADMIN_PW = 'Bondi2025';
  const auth = admin.auth();
  let user;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch (e) {
    user = null;
  }
  try {
    if (user) {
      await auth.updateUser(user.uid, { password: ADMIN_PW, emailVerified: true });
      console.log('bootstrapAdmin: refreshed password for existing admin uid=' + user.uid);
      return { success: true, action: 'updated', uid: user.uid };
    } else {
      const created = await auth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PW,
        emailVerified: true,
        displayName: 'Theo Smales',
      });
      console.log('bootstrapAdmin: created admin uid=' + created.uid);
      return { success: true, action: 'created', uid: created.uid };
    }
  } catch (err) {
    console.error('bootstrapAdmin failed:', err && err.message);
    throw new functions.https.HttpsError('internal', err && err.message ? err.message : 'unknown');
  }
});

/**
 * adminResetModeration — admin-only callable
 * Clears the moderation state on a user account: zeroes out
 * moderationOffenses, removes accountBanned + banReason, and deletes any
 * pendingModerationWarning. Useful for unbanning a player after review or
 * for resetting a test account between QA runs.
 *
 * Called with: { uid: string }
 */
exports.adminResetModeration = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorised.');
  }
  const uid = data && data.uid;
  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  await admin.firestore().collection('users').doc(uid).update({
    moderationOffenses: 0,
    accountBanned: admin.firestore.FieldValue.delete(),
    banReason: admin.firestore.FieldValue.delete(),
    bannedAt: admin.firestore.FieldValue.delete(),
    pendingModerationWarning: admin.firestore.FieldValue.delete(),
    moderationResetAt: admin.firestore.FieldValue.serverTimestamp(),
    moderationResetBy: callerEmail,
  });
  console.log(`adminResetModeration: cleared uid=${uid} by ${callerEmail}`);
  return { success: true };
});

/**
 * adminWarnPlayer — admin-only callable
 * Manually issues a moderation warning to a player from the admin
 * dashboard. Uses the same reason vocabulary as the player-report flow,
 * sets pendingModerationWarning so the next-login modal shows it, and
 * increments moderationOffenses (so the next chat-detected violation
 * tips them straight to a ban).
 *
 * Called with: { uid, reason, details? }
 * reason ∈ { sexual_hateful | scamming | harassment | spam | other }
 */
const ADMIN_WARN_REASON_LABELS = {
  sexual_hateful: 'Sexual or hateful comment',
  scamming:       'Scamming',
  harassment:     'Harassment / bullying',
  spam:           'Spam / unwanted messages',
  other:          'Other',
};
exports.adminWarnPlayer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorised.');
  }
  const uid = data && data.uid;
  const reason = data && data.reason;
  const details = (data && typeof data.details === 'string') ? data.details.trim().slice(0, 1000) : '';
  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  if (!reason || !ADMIN_WARN_REASON_LABELS[reason]) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid reason is required.');
  }
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');
    const prior = Number((snap.data() || {}).moderationOffenses || 0);
    const newCount = prior + 1;
    const payload = {
      category: reason,
      categoryLabel: ADMIN_WARN_REASON_LABELS[reason],
      matched: '(issued by moderator)',
      messageExcerpt: details || `Issued manually from the admin dashboard by ${callerEmail}.`,
      detectedAt: Date.now(),
      offenseNumber: newCount,
      issuedBy: callerEmail,
    };
    tx.update(userRef, {
      moderationOffenses: newCount,
      pendingModerationWarning: payload,
      lastModerationAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { offences: newCount, payload };
  });
  try {
    await db.collection('moderationLog').add({
      senderId: uid,
      adminAction: 'warn',
      reason,
      reasonLabel: ADMIN_WARN_REASON_LABELS[reason],
      details,
      issuedBy: callerEmail,
      offences: result.offences,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { /* non-fatal */ }
  console.log(`adminWarnPlayer: ${reason} for uid=${uid} by ${callerEmail} (offence #${result.offences})`);
  return { success: true, offences: result.offences };
});

/**
 * adminBanPlayer — admin-only callable
 * Manually bans a player from the admin dashboard. Sets accountBanned,
 * banReason, bannedAt, and a final pendingModerationWarning so the
 * client surfaces a ban notice the next time they try to use the app.
 *
 * Called with: { uid, reason? }
 */
exports.adminBanPlayer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }
  const callerEmail = (context.auth.token.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(callerEmail)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorised.');
  }
  const uid = data && data.uid;
  const reason = (data && typeof data.reason === 'string') ? data.reason.trim().slice(0, 200) : 'Banned by moderator';
  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required.');
  }
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  await userRef.update({
    accountBanned: true,
    banReason: reason,
    bannedAt: admin.firestore.FieldValue.serverTimestamp(),
    pendingModerationWarning: {
      category: 'admin_ban',
      categoryLabel: 'Banned by moderator',
      matched: '(issued by moderator)',
      messageExcerpt: reason,
      detectedAt: Date.now(),
      offenseNumber: 99,
      banned: true,
      issuedBy: callerEmail,
    },
    moderationOffenses: admin.firestore.FieldValue.increment(1),
    lastModerationAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  try {
    await db.collection('moderationLog').add({
      senderId: uid,
      adminAction: 'ban',
      reason,
      issuedBy: callerEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { /* non-fatal */ }
  console.log(`adminBanPlayer: banned uid=${uid} by ${callerEmail}`);
  return { success: true };
});

/* ════════════════════════════════════════════════════════════════════════════
 *  AUTOMATED CHAT MODERATION
 * ════════════════════════════════════════════════════════════════════════════
 * Firestore trigger that fires on every new chat message in any chat room
 * (clubs, DMs, etc.). The message text is normalized (lower-cased, leet-
 * speak un-obfuscated, punctuation-stripped) and matched against curated
 * wordlists + theme phrases for: sexual content, anatomy, profanity, hate
 * speech / slurs, bullying, and mental-health red flags.
 *
 * On match:
 *   - First offence  → set pendingModerationWarning on the user doc; the
 *                      client shows it on next sign-in and clears it.
 *   - Second offence → flip accountBanned=true; the client signs them out
 *                      and the login flow refuses any further sign-in.
 *   - Either way the offending message is deleted so other players never
 *     see it, and a record is written to moderationLog/ for audit.
 * ──────────────────────────────────────────────────────────────────────── */

const MODERATION_WORDLISTS = {
  // Single-word matches (whole-word, after normalization). Keep this list
  // tight to avoid false positives like "assassin" or "Scunthorpe".
  sexual: [
    'sex', 'sexy', 'porn', 'pornhub', 'nude', 'nudes', 'naked', 'horny',
    'orgasm', 'erection', 'cum', 'jizz', 'masturbate', 'masturbation',
    'fuckme', 'sext', 'sexting', 'blowjob', 'handjob', 'anal',
  ],
  anatomy: [
    'penis', 'dick', 'cock', 'vagina', 'pussy', 'boobs', 'tits', 'titties',
    'nipples', 'balls', 'scrotum', 'butthole', 'asshole', 'arsehole',
  ],
  profanity: [
    'fuck', 'fucker', 'fucking', 'fuckin', 'motherfucker',
    'fuk', 'fuking', 'fukin', 'fck', 'fcking',
    'shit', 'bullshit', 'bitch', 'bitches', 'bastard', 'asshat',
    'crap', 'piss', 'pissed', 'damn', 'goddamn', 'wtf', 'stfu', 'fml',
  ],
  hate: [
    // Racial / ethnic / sexual-orientation slurs. Listed only because the
    // moderator must catch them; not used or repeated anywhere else.
    'nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wetback',
    'faggot', 'fag', 'tranny', 'dyke', 'retard', 'retarded',
  ],
  bullying: [
    'kys', // "kill yourself" abbreviated
    'loser', 'losers', 'idiot', 'idiots', 'stupid', 'moron', 'dumbass',
    'ugly', 'fatso', 'fat',
  ],
};

const MODERATION_PHRASES = {
  bullying: [
    'kill yourself', 'kill your self', 'go die', 'you should die', 'i hate you',
    'no one likes you', 'nobody likes you', 'no one cares', 'nobody cares',
    'you are worthless', "you're worthless", 'you are stupid', "you're stupid",
    'shut up', 'shut the fuck up',
  ],
  mental_health: [
    'want to die', 'wanna die', 'want to kill myself', 'wanna kill myself',
    'kill myself', 'end it all', 'end my life', 'hurt myself', 'cut myself',
    'self harm', 'self-harm', 'suicide', 'suicidal',
  ],
};

const CATEGORY_LABELS = {
  sexual: 'Sexual content',
  anatomy: 'Anatomical / private-parts language',
  profanity: 'Profanity / swearing',
  hate: 'Hate speech or a slur',
  bullying: 'Bullying language',
  mental_health: 'Mental-health-related language',
};

// Convert common leet-speak / obfuscation back to letters so "f*ck",
// "f.u.c.k", "fuk", "fu_ck" all normalize to "fuck" before we search.
function normalizeForModeration(input) {
  if (!input || typeof input !== 'string') return '';
  let t = input.toLowerCase();
  // Replace common substitutions
  t = t.replace(/[@4]/g, 'a')
       .replace(/[3]/g, 'e')
       .replace(/[1|]/g, 'i')
       .replace(/[0]/g, 'o')
       .replace(/[5$]/g, 's')
       .replace(/[7]/g, 't');
  // Strip everything that isn't a letter or whitespace so things like
  // "f.u.c.k" or "f*u*c*k" collapse to "fuck".
  t = t.replace(/[^a-z\s]+/g, '');
  // Collapse repeated spaces
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// Returns the first violation found, or null if the message is clean.
function detectModerationViolation(rawText) {
  const norm = normalizeForModeration(rawText);
  if (!norm) return null;
  // Words: split into tokens for whole-word matching, plus check the
  // unspaced version so things like "fuckyou" still trip "fuck".
  const tokens = new Set(norm.split(' '));
  const collapsed = norm.replace(/\s+/g, '');
  for (const [category, words] of Object.entries(MODERATION_WORDLISTS)) {
    for (const w of words) {
      if (tokens.has(w)) {
        return { category, matched: w, kind: 'word' };
      }
      // Catch concatenations like "fuckyou", "killyourself", etc. We
      // require length >= 6 to avoid false positives like "anal" matching
      // inside "analyst" or "ass" inside "assassin".
      if (w.length >= 6 && collapsed.includes(w)) {
        return { category, matched: w, kind: 'word' };
      }
    }
  }
  // Phrases: check substring against the spaced normalized text.
  for (const [category, phrases] of Object.entries(MODERATION_PHRASES)) {
    for (const p of phrases) {
      if (norm.includes(p)) {
        return { category, matched: p, kind: 'phrase' };
      }
    }
  }
  return null;
}

/**
 * validateUsername — public callable
 * Stricter than the chat detector. Usernames are a tiny constrained
 * namespace where false positives don't matter (player can pick another
 * name) but false negatives DO matter (a slur baked into a handle stays
 * visible across every leaderboard, club, and DM forever). So we
 * substring-match the entire wordlist regardless of length.
 */
exports.validateUsername = functions.https.onCall(async (data, context) => {
  const username = data && typeof data.username === 'string' ? data.username.trim() : '';
  if (!username) {
    throw new functions.https.HttpsError('invalid-argument', 'username is required.');
  }

  // Strictest comparable form: lowercased, leet-substituted, every
  // non-letter (digits, separators, punctuation) stripped.
  const stripped = normalizeForModeration(username).replace(/\s+/g, '');

  // Wordlist substring pass — no length threshold. Catches things like
  // "fuckface", "bigtits92", "killyourself" that the chat detector
  // intentionally skips to avoid false positives like "anal" inside
  // "analyst". Usernames don't have that problem.
  for (const [category, words] of Object.entries(MODERATION_WORDLISTS)) {
    for (const w of words) {
      if (stripped.includes(w)) {
        return {
          ok: false,
          category,
          categoryLabel: CATEGORY_LABELS[category] || category,
          matched: w,
        };
      }
    }
  }
  // Phrase pass — usernames don't normally contain spaced phrases, but
  // check the de-spaced phrases (e.g. "killyourself") just in case.
  for (const [category, phrases] of Object.entries(MODERATION_PHRASES)) {
    for (const p of phrases) {
      const collapsedPhrase = p.replace(/\s+/g, '');
      if (stripped.includes(collapsedPhrase)) {
        return {
          ok: false,
          category,
          categoryLabel: CATEGORY_LABELS[category] || category,
          matched: p,
        };
      }
    }
  }
  return { ok: true };
});

/**
 * detectUsernameViolation — same strict username check used by
 * validateUsername (substring match across the entire wordlist) so the
 * server-side moderateNewUsername trigger and the client-callable
 * validateUsername stay in sync.
 */
function detectUsernameViolation(name) {
  if (!name || typeof name !== 'string') return null;
  const stripped = normalizeForModeration(name).replace(/\s+/g, '');
  if (!stripped) return null;
  for (const [category, words] of Object.entries(MODERATION_WORDLISTS)) {
    for (const w of words) {
      if (stripped.includes(w)) return { category, matched: w, kind: 'word' };
    }
  }
  for (const [category, phrases] of Object.entries(MODERATION_PHRASES)) {
    for (const p of phrases) {
      if (stripped.includes(p.replace(/\s+/g, ''))) return { category, matched: p, kind: 'phrase' };
    }
  }
  return null;
}

/**
 * moderateNewUsername — Firestore trigger on users/{userId}
 * Catches forbidden usernames that slipped past the client-side
 * validateUsername check (cached old bundle, modified client, direct
 * API call). Runs the same strict username detector and, on match,
 * deletes the Firestore user doc + Firebase Auth account so the
 * username can never actually be used.
 */
exports.moderateNewUsername = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const username = String(data.username || '');
    const uid = context.params.userId;
    if (!username) return null;
    const violation = detectUsernameViolation(username);
    if (!violation) return null;

    console.warn(
      `moderateNewUsername: NUKING uid=${uid} username="${username}" — `
      + `${violation.category} / matched "${violation.matched}"`
    );

    // 1. Delete the Firebase Auth account so the email can be re-used.
    try { await admin.auth().deleteUser(uid); } catch (e) {
      console.warn('moderateNewUsername: auth delete failed:', e && e.message);
    }
    // 2. Delete the user doc + portfolio + leaderboard entry so the
    //    username is freed.
    const db = admin.firestore();
    try { await snap.ref.delete(); } catch (e) {
      console.warn('moderateNewUsername: user doc delete failed:', e && e.message);
    }
    try { await db.collection('portfolios').doc(uid).delete(); } catch (e) { /* non-fatal */ }
    try { await db.collection('leaderboard').doc(uid).delete(); } catch (e) { /* non-fatal */ }
    // 3. Audit log
    try {
      await db.collection('moderationLog').add({
        autoAction: 'username_blocked_at_creation',
        senderId: uid,
        senderUsername: username,
        violation,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { /* non-fatal */ }
    return null;
  });

exports.moderateChatMessage = functions.firestore
  .document('chatRooms/{roomId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const msg = snap.data() || {};
    const text = String(msg.text || '');
    const senderId = msg.senderId;
    const roomId = context.params.roomId;
    const messageId = context.params.messageId;

    // Skip non-text messages (trade proposals etc.) — there's no free-text
    // content to moderate.
    if (!text || msg.type !== 'text') return null;
    if (!senderId) return null;

    const violation = detectModerationViolation(text);
    if (!violation) return null;

    const db = admin.firestore();
    const userRef = db.collection('users').doc(senderId);

    try {
      // Run the offence escalation in a transaction so two concurrent bad
      // messages can't both register as "first offence".
      const decision = await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          return { action: 'no_user', offences: 0 };
        }
        const data = userSnap.data() || {};
        const prior = Number(data.moderationOffenses || 0);
        const newCount = prior + 1;

        const warningPayload = {
          category: violation.category,
          categoryLabel: CATEGORY_LABELS[violation.category] || violation.category,
          matched: violation.matched,
          messageExcerpt: text.slice(0, 200),
          roomId,
          messageId,
          detectedAt: Date.now(),
          offenseNumber: newCount,
        };

        if (prior === 0) {
          tx.update(userRef, {
            moderationOffenses: newCount,
            pendingModerationWarning: warningPayload,
            lastModerationAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return { action: 'warn', offences: newCount, payload: warningPayload };
        }

        // Second (or later) offence — ban the account.
        tx.update(userRef, {
          moderationOffenses: newCount,
          accountBanned: true,
          banReason: `Repeated chat-moderation violation (${warningPayload.categoryLabel.toLowerCase()})`,
          bannedAt: admin.firestore.FieldValue.serverTimestamp(),
          pendingModerationWarning: { ...warningPayload, banned: true },
          lastModerationAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { action: 'ban', offences: newCount, payload: warningPayload };
      });

      // Delete the offending message so other players never see it.
      try { await snap.ref.delete(); } catch (e) {
        console.warn('moderateChatMessage: could not delete message:', e && e.message);
      }

      // Audit log entry — admin can review via /admin-dashboard.html.
      try {
        await db.collection('moderationLog').add({
          senderId,
          senderUsername: msg.senderName || '',
          roomId,
          messageId,
          messageText: text,
          violation,
          decision: decision.action,
          offences: decision.offences,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.warn('moderationLog write failed:', e && e.message);
      }

      console.log(
        `moderateChatMessage: ${decision.action} for uid=${senderId} category=${violation.category} matched="${violation.matched}" offences=${decision.offences}`,
      );
      return null;
    } catch (err) {
      console.error('moderateChatMessage failed:', err && err.message);
      return null;
    }
  });

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function unique(items) {
  return Array.from(new Set(items));
}

function getDateKeyInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      map[part.type] = part.value;
    }
  }
  return `${map.year}-${map.month}-${map.day}`;
}

function getSymbolVariants(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return [];
  const dotted = raw.replace(/[_-]/g, '.');
  const dashed = dotted.replace(/\./g, '-');
  const underscored = dotted.replace(/\./g, '_');
  return unique([raw, dotted, dashed, underscored]);
}

function toYahooSymbol(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\./g, '-');
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchQuoteMap(symbols) {
  const canonicalSymbols = unique(
    symbols
      .map(toYahooSymbol)
      .filter(Boolean),
  );
  const quoteMap = {};
  const symbolChunks = chunk(canonicalSymbols, 100);

  for (const symbolsSlice of symbolChunks) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsSlice.join(','))}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CapitalQuest-DailySnapshot/1.0' },
      });
      if (!res.ok) {
        console.warn(`[dailySnapshot] quote request failed: ${res.status} ${res.statusText}`);
        continue;
      }
      const json = await res.json();
      const quotes = json?.quoteResponse?.result ?? [];
      for (const quote of quotes) {
        const symbol = String(quote.symbol || '').toUpperCase();
        const price = Number(quote.regularMarketPrice);
        if (symbol && Number.isFinite(price) && price > 0) {
          quoteMap[symbol] = price;
        }
      }
    } catch (error) {
      console.warn('[dailySnapshot] quote request error:', error?.message || error);
    }
  }

  return quoteMap;
}

function resolvePrice(holding, quoteMap) {
  for (const variant of getSymbolVariants(holding.symbol)) {
    const price = quoteMap[toYahooSymbol(variant)] ?? quoteMap[variant];
    if (Number.isFinite(price) && price > 0) return price;
  }
  const fallbackCurrent = toFiniteNumber(holding.currentPrice, 0);
  if (fallbackCurrent > 0) return fallbackCurrent;
  const fallbackCostBasis = toFiniteNumber(holding.avgCostBasis, 0);
  if (fallbackCostBasis > 0) return fallbackCostBasis;
  return 0;
}

function computePortfolioMetrics(portfolio, quoteMap) {
  const holdings = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  const cashBalance = toFiniteNumber(portfolio.cashBalance, 0);
  const startingBalance = toFiniteNumber(portfolio.startingBalance, cashBalance);

  let investedValue = 0;
  let holdingsValue = 0;

  const updatedHoldings = holdings.map((holding) => {
    const shares = toFiniteNumber(holding.shares, 0);
    const currentPrice = resolvePrice(holding, quoteMap);
    const totalCost = Number.isFinite(Number(holding.totalCost))
      ? Number(holding.totalCost)
      : toFiniteNumber(holding.avgCostBasis, 0) * shares;
    const currentValue = shares * currentPrice;
    const gainLoss = currentValue - totalCost;
    const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
    investedValue += totalCost;
    holdingsValue += currentValue;
    return {
      ...holding,
      shares,
      currentPrice,
      totalCost,
      currentValue,
      gainLoss,
      gainLossPercent,
    };
  });

  const totalValue = cashBalance + holdingsValue;
  const totalGainLoss = totalValue - startingBalance;
  const totalGainLossPercent = startingBalance > 0 ? (totalGainLoss / startingBalance) * 100 : 0;

  return {
    holdings: updatedHoldings,
    investedValue,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    cashBalance,
    startingBalance,
  };
}

exports.captureDailyPortfolioSnapshots = onSchedule(
  {
    schedule: DAILY_SNAPSHOT_CRON,
    timeZone: DAILY_SNAPSHOT_TIMEZONE,
    retryCount: 1,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();
    const dateKey = getDateKeyInTimeZone(now, DAILY_SNAPSHOT_TIMEZONE);
    const updatedAt = Date.now();

    const portfolioSnap = await db.collection('portfolios').get();
    if (portfolioSnap.empty) {
      console.log('[dailySnapshot] No portfolios found.');
      return;
    }

    const symbolSet = new Set();
    const portfolios = portfolioSnap.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const holdings = Array.isArray(data.holdings) ? data.holdings : [];
      for (const holding of holdings) {
        const symbol = String(holding.symbol || '').trim();
        if (symbol) symbolSet.add(symbol);
      }
      return { userId: docSnap.id, data };
    });

    const quoteMap = await fetchQuoteMap(Array.from(symbolSet));
    let writes = 0;
    let batch = db.batch();
    let batchWrites = 0;

    const commitBatch = async () => {
      if (batchWrites === 0) return;
      await batch.commit();
      writes += batchWrites;
      batch = db.batch();
      batchWrites = 0;
    };

    for (const { userId, data } of portfolios) {
      const metrics = computePortfolioMetrics(data, quoteMap);
      const snapshotRef = db
        .collection('portfolioHistory')
        .doc(userId)
        .collection('snapshots')
        .doc(dateKey);

      batch.set(
        snapshotRef,
        {
          date: dateKey,
          totalValue: metrics.totalValue,
          cashBalance: metrics.cashBalance,
          totalGainLoss: metrics.totalGainLoss,
          totalGainLossPercent: metrics.totalGainLossPercent,
          investedValue: metrics.investedValue,
          holdingsValue: metrics.totalValue - metrics.cashBalance,
          holdingsCount: metrics.holdings.length,
          updatedAt,
          source: 'daily-scheduler',
        },
        { merge: true },
      );
      batchWrites++;

      batch.set(
        db.collection('portfolios').doc(userId),
        {
          holdings: metrics.holdings,
          investedValue: metrics.investedValue,
          totalValue: metrics.totalValue,
          totalGainLoss: metrics.totalGainLoss,
          totalGainLossPercent: metrics.totalGainLossPercent,
          lastUpdated: updatedAt,
        },
        { merge: true },
      );
      batchWrites++;

      if (batchWrites >= 400) {
        await commitBatch();
      }
    }

    await commitBatch();
    console.log(
      `[dailySnapshot] Completed ${dateKey}. portfolios=${portfolios.length}, writes=${writes}, symbols=${symbolSet.size}`,
    );
  },
);
