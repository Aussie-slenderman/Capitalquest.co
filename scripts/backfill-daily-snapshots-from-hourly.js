const admin = require('firebase-admin');

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawServiceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is required (JSON string).');
}
const DRY_RUN = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(rawServiceAccount);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dayKeyFromTimestamp(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

async function backfillUser(userId) {
  const hourlySnap = await db
    .collection('portfolioHistory')
    .doc(userId)
    .collection('hourly')
    .orderBy('timestamp', 'asc')
    .get();

  if (hourlySnap.empty) return { userId, dailyRows: 0, writes: 0 };

  // Keep the latest hourly record per day.
  const latestByDay = new Map();
  for (const docSnap of hourlySnap.docs) {
    const data = docSnap.data() || {};
    const timestamp = toFiniteNumber(data.timestamp, 0);
    if (timestamp <= 0) continue;
    const totalValue = toFiniteNumber(data.totalValue, 0);
    const dayKey = dayKeyFromTimestamp(timestamp);
    const prev = latestByDay.get(dayKey);
    if (!prev || timestamp > prev.timestamp) {
      latestByDay.set(dayKey, { timestamp, totalValue });
    }
  }

  if (latestByDay.size === 0) return { userId, dailyRows: 0, writes: 0 };

  let writes = 0;
  let batch = db.batch();
  let batchWrites = 0;

  const commitBatch = async () => {
    if (batchWrites === 0) return;
    if (DRY_RUN) {
      writes += batchWrites;
      batch = db.batch();
      batchWrites = 0;
      return;
    }
    await batch.commit();
    writes += batchWrites;
    batch = db.batch();
    batchWrites = 0;
  };

  for (const [dayKey, point] of Array.from(latestByDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const dailyRef = db
      .collection('portfolioHistory')
      .doc(userId)
      .collection('snapshots')
      .doc(dayKey);

    batch.set(
      dailyRef,
      {
        date: dayKey,
        totalValue: point.totalValue,
        updatedAt: point.timestamp,
        source: 'hourly-backfill',
      },
      { merge: true },
    );
    batchWrites++;

    if (batchWrites >= 400) await commitBatch();
  }

  await commitBatch();
  return { userId, dailyRows: latestByDay.size, writes };
}

async function main() {
  console.log(`[backfill] Starting hourly -> daily snapshot migration... dryRun=${DRY_RUN}`);

  const portfolioUsersSnap = await db.collection('portfolios').select().get();
  if (portfolioUsersSnap.empty) {
    console.log('[backfill] No portfolios found.');
    return;
  }

  let totalUsers = 0;
  let totalRows = 0;
  let totalWrites = 0;

  for (const userDoc of portfolioUsersSnap.docs) {
    totalUsers++;
    const result = await backfillUser(userDoc.id);
    totalRows += result.dailyRows;
    totalWrites += result.writes;
    console.log(
      `[backfill] user=${result.userId} dailyRows=${result.dailyRows} writes=${result.writes}`,
    );
  }

  console.log(
    `[backfill] Done. users=${totalUsers} dailyRows=${totalRows} writes=${totalWrites}`,
  );

  if (!DRY_RUN) {
    const migrationId = `backfill-daily-snapshots-from-hourly-${new Date().toISOString()}`;
    await db.collection('opsMigrations').doc(migrationId).set({
      migration: 'backfill-daily-snapshots-from-hourly',
      executedAt: Date.now(),
      users: totalUsers,
      dailyRows: totalRows,
      writes: totalWrites,
    });
    console.log(`[backfill] Logged migration record: opsMigrations/${migrationId}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] Failed:', err);
    process.exit(1);
  });
