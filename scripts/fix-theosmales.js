/**
 * One-time fix: reset theosmales Firebase Auth password to match Firestore,
 * merge duplicate docs, delete the extra one.
 */
const admin = require('firebase-admin');
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error('Need FIREBASE_SERVICE_ACCOUNT'); process.exit(1); }
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const auth = admin.auth();

const INTERNAL_PW = 'CQ_internal_session_2026';
const CORRECT_UID = 'TSBViDzaBuQRtso6wmnraQ5hS4Z2';
const DUPE_UID = 'In9cJ39e2iUW6PvFMNFii05OZd83';

(async () => {
  // Get both docs
  const correctSnap = await db.doc(`users/${CORRECT_UID}`).get();
  const dupeSnap = await db.doc(`users/${DUPE_UID}`).get();
  const correctData = correctSnap.data() || {};
  const dupeData = dupeSnap.data() || {};

  console.log('Correct doc (TSB):', { pw: correctData.storedPassword, country: correctData.country, email: correctData.userEmail });
  console.log('Dupe doc (In9):', { pw: dupeData.storedPassword, country: dupeData.country, email: dupeData.userEmail });

  // Take the most recent storedPassword
  const finalPassword = dupeData.storedPassword || correctData.storedPassword || 'Bondi2025';
  console.log('\nFinal password will be:', finalPassword);

  // Merge important fields from dupe into correct
  const merge = { storedPassword: finalPassword };
  if (dupeData.country) merge.country = dupeData.country;
  if (dupeData.avatarConfig) merge.avatarConfig = dupeData.avatarConfig;
  if (dupeData.userEmail) merge.userEmail = dupeData.userEmail;
  if (dupeData.notificationEmail) merge.notificationEmail = dupeData.notificationEmail;
  if (dupeData.accountNumber) merge.accountNumber = dupeData.accountNumber;

  await db.doc(`users/${CORRECT_UID}`).set(merge, { merge: true });
  console.log('Merged fields:', Object.keys(merge));

  // Set Firebase Auth password to internal password for CORRECT UID
  await auth.updateUser(CORRECT_UID, { password: INTERNAL_PW });
  console.log('Set Firebase Auth password for', CORRECT_UID, 'to INTERNAL_PW');

  // Also fix the DUPE UID's Firebase Auth if it exists
  try {
    await auth.updateUser(DUPE_UID, { password: INTERNAL_PW });
    console.log('Set Firebase Auth password for', DUPE_UID, 'to INTERNAL_PW');
  } catch (e) {
    console.log('Dupe UID not in Firebase Auth:', e.message);
  }

  // Delete the duplicate Firestore doc
  await db.doc(`users/${DUPE_UID}`).delete();
  console.log('Deleted duplicate doc:', DUPE_UID);

  console.log('\nDone! User can now sign in with username "theosmales" and password "' + finalPassword + '"');
})().catch(e => { console.error(e); process.exit(1); });
