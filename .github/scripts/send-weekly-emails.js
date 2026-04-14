'use strict';

const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios      = require('axios');

// ── Firebase Admin init ───────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ── Gmail transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function gainColor(n) {
  return n >= 0 ? '#00C853' : '#FF3D57';
}

/**
 * Build a QuickChart.io line chart URL for a 7-day portfolio history.
 * @param {Array<{date: string, value: number}>} snapshots
 */
function buildChartUrl(snapshots) {
  if (!snapshots || snapshots.length < 2) return null;

  const labels = snapshots.map(s => s.date);
  const data   = snapshots.map(s => s.value);
  const min    = Math.min(...data);
  const max    = Math.max(...data);
  const pad    = (max - min) * 0.1 || 100;

  const chart = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Portfolio Value',
        data,
        borderColor: '#00B3E6',
        backgroundColor: 'rgba(0,179,230,0.15)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#00B3E6',
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: '#94A3B8', font: { size: 11 } },
          grid:  { color: '#1A2235' },
        },
        y: {
          min: Math.floor(min - pad),
          max: Math.ceil(max + pad),
          ticks: {
            color: '#94A3B8',
            font: { size: 11 },
            callback: (v) => '$' + v.toLocaleString(),
          },
          grid: { color: '#1A2235' },
        },
      },
      backgroundColor: '#111827',
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(chart));
  return `https://quickchart.io/chart?c=${encoded}&backgroundColor=%23111827&width=560&height=220`;
}

/**
 * Build the HTML email body for one user.
 */
function buildEmail(username, portfolioValue, totalGainLoss, gainPct, topHoldings, chartUrl) {
  const gainStr  = fmt(Math.abs(totalGainLoss));
  const gainSign = totalGainLoss >= 0 ? '+' : '-';
  const gColor   = gainColor(totalGainLoss);

  const holdingsRows = topHoldings.map(h => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #1A2235">
        <div style="font-weight:700;font-size:15px;color:#F1F5F9">${h.symbol}</div>
        <div style="font-size:12px;color:#94A3B8;margin-top:2px">${h.shares} shares</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #1A2235;text-align:right">
        <div style="font-weight:700;font-size:15px;color:#F1F5F9">${fmt(h.value)}</div>
        <div style="font-size:12px;color:${gainColor(h.gainLoss)};margin-top:2px">
          ${h.gainLoss >= 0 ? '+' : ''}${fmt(h.gainLoss)} (${fmtPct(h.gainPct)})
        </div>
      </td>
    </tr>`).join('');

  const chartSection = chartUrl
    ? `<img src="${chartUrl}" alt="7-Day Portfolio Chart" style="width:100%;max-width:560px;border-radius:12px;margin:0 0 24px;display:block"/>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Weekly CapitalQuest Update</title>
</head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E1A;padding:24px 0">
  <tr><td align="center">
    <table width="100%" style="max-width:600px;background:#111827;border-radius:20px;overflow:hidden;border:1px solid #1A2235" cellpadding="0" cellspacing="0">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#00B3E6,#0096C7);padding:28px 32px;text-align:center">
        <div style="font-size:28px;margin-bottom:6px">📊</div>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800">Your Weekly CapitalQuest Update</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Hi ${escHtml(username)} — here's how your portfolio performed this week</p>
      </td></tr>

      <!-- Portfolio summary -->
      <tr><td style="padding:28px 32px 20px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#0A0E1A;border-radius:14px;padding:18px;text-align:center;width:48%">
              <div style="font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Portfolio Value</div>
              <div style="font-size:26px;font-weight:800;color:#F1F5F9">${fmt(portfolioValue)}</div>
            </td>
            <td style="width:4%"></td>
            <td style="background:#0A0E1A;border-radius:14px;padding:18px;text-align:center;width:48%">
              <div style="font-size:12px;color:#94A3B8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Total Gain / Loss</div>
              <div style="font-size:26px;font-weight:800;color:${gColor}">${gainSign}${gainStr}</div>
              <div style="font-size:14px;font-weight:600;color:${gColor};margin-top:2px">${fmtPct(gainPct)}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Chart -->
      ${chartSection ? `<tr><td style="padding:0 32px 20px">${chartSection}</td></tr>` : ''}

      <!-- Top holdings -->
      ${topHoldings.length > 0 ? `
      <tr><td style="padding:0 32px 24px">
        <h2 style="margin:0 0 14px;font-size:16px;font-weight:700;color:#F1F5F9">Top Holdings</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="color:#F1F5F9">
          ${holdingsRows}
        </table>
      </td></tr>` : ''}

      <!-- CTA -->
      <tr><td style="padding:0 32px 28px;text-align:center">
        <a href="https://capitalquest-4d20b.web.app/home" style="display:inline-block;padding:14px 32px;background:linear-gradient(90deg,#00B3E6,#0096C7);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px">Open CapitalQuest →</a>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0A0E1A;padding:20px 32px;text-align:center;border-top:1px solid #1A2235">
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.6">
          You're receiving this because you opted in to weekly portfolio updates.<br/>
          To unsubscribe, open the app → Settings → Email Updates → Remove notification email.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Fetch portfolio snapshots for a user ──────────────────────────────────────
async function getPortfolioHistory(uid) {
  try {
    const now      = new Date();
    const cutoff   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const snap     = await db
      .collection('portfolioHistory')
      .doc(uid)
      .collection('snapshots')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoff))
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();

    if (snap.empty) return [];

    return snap.docs.map(doc => {
      const d   = doc.data();
      const ts  = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
      const day = ts.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return { date: day, value: d.portfolioValue || d.value || 0 };
    });
  } catch (e) {
    console.warn(`  Could not fetch history for ${uid}: ${e.message}`);
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('CapitalQuest — Weekly Portfolio Emailer starting…');

  // Fetch all users with a verified notification email
  let usersSnap;
  try {
    usersSnap = await db.collection('users')
      .where('emailVerified', '==', true)
      .get();
  } catch (e) {
    console.error('Failed to query users:', e.message);
    process.exit(1);
  }

  const users = usersSnap.docs.filter(doc => {
    const d = doc.data();
    const email = d.notificationEmail || d.userEmail;
    return email && typeof email === 'string';
  });

  console.log(`Found ${users.length} user(s) to email.`);

  let sent = 0, failed = 0;

  for (const doc of users) {
    const uid  = doc.id;
    const data = doc.data();
    const to   = data.notificationEmail || data.userEmail;
    const name = data.username || data.displayName || 'Player';

    console.log(`Processing ${uid} (${to})…`);

    try {
      // Portfolio totals
      const holdings    = data.portfolio || {};
      const cashBalance = data.balance || 0;
      let   portfolioValue = cashBalance;
      let   totalCost      = 0;
      const topHoldings    = [];

      for (const [symbol, position] of Object.entries(holdings)) {
        if (!position || !position.shares) continue;
        const currentPrice = position.currentPrice || position.avgPrice || 0;
        const value        = position.shares * currentPrice;
        const cost         = position.shares * (position.avgPrice || currentPrice);
        const gainLoss     = value - cost;
        const gainPct      = cost > 0 ? (gainLoss / cost) * 100 : 0;

        portfolioValue += value;
        totalCost      += cost;

        topHoldings.push({ symbol, shares: position.shares, value, gainLoss, gainPct });
      }

      // Sort by value desc, take top 3
      topHoldings.sort((a, b) => b.value - a.value);
      const top3 = topHoldings.slice(0, 3);

      const startingBalance = data.startingBalance || data.initialBalance || 10000;
      const totalGainLoss   = portfolioValue - startingBalance;
      const gainPct         = startingBalance > 0 ? (totalGainLoss / startingBalance) * 100 : 0;

      // Chart
      const history  = await getPortfolioHistory(uid);
      const chartUrl = buildChartUrl(history);

      // Build & send email
      const html = buildEmail(name, portfolioValue, totalGainLoss, gainPct, top3, chartUrl);

      await transporter.sendMail({
        from:    `"CapitalQuest" <${process.env.GMAIL_USER}>`,
        to,
        subject: `📊 Your Weekly Portfolio Update — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        html,
      });

      console.log(`  ✓ Sent to ${to}`);
      sent++;
    } catch (e) {
      console.error(`  ✗ Failed for ${uid} (${to}): ${e.message}`);
      failed++;
      // Continue with next user
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
