const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
