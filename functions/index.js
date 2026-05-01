const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

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
