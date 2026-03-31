/**
 * CapitalQuest — Weekly Performance Email Script
 *
 * Runs every Monday via GitHub Actions.
 * Reads all users + their portfolio history from Firestore,
 * generates a line chart via QuickChart.io, and sends
 * a styled HTML email via Resend.
 *
 * Required environment variables (set as GitHub Secrets):
 *   FIREBASE_SERVICE_ACCOUNT  — JSON string of your Firebase service account key
 *   RESEND_API_KEY            — API key from resend.com (free tier: 3,000/month)
 */

const admin = require('firebase-admin');
const { Resend } = require('resend');

// ─── Init Firebase Admin ──────────────────────────────────────────────────────

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── Init Resend ──────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Get last 7 day-strings: ['2026-03-16', ..., '2026-03-22']
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// Short day labels: Mon, Tue, ...
function getDayLabels(dateStrings) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dateStrings.map(s => {
    const d = new Date(s + 'T12:00:00Z');
    return names[d.getUTCDay()];
  });
}

// Build a QuickChart.io URL for a line graph
function buildChartUrl(labels, values, isPositive) {
  const color = isPositive ? 'rgba(0,200,83,1)' : 'rgba(255,61,87,1)';
  const fillColor = isPositive ? 'rgba(0,200,83,0.15)' : 'rgba(255,61,87,0.15)';

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        backgroundColor: fillColor,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: color,
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
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          ticks: {
            color: '#94A3B8',
            font: { size: 11 },
            callback: (v) => `$${(v / 1000).toFixed(1)}K`,
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
      layout: { padding: { top: 10, bottom: 10, left: 8, right: 8 } },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?w=540&h=220&bkg=%230A0E1A&c=${encoded}`;
}

// Build the HTML email
function buildEmail(user, weeklyGain, weeklyGainPct, currentValue, chartUrl, dayLabels, values, marketRecap) {
  const isPositive = weeklyGain >= 0;
  const gainColor = isPositive ? '#00C853' : '#FF3D57';
  const gainArrow = isPositive ? '▲' : '▼';
  const gainLabel = isPositive ? 'gained' : 'lost';

  // Best/worst day
  let bestDay = null, bestVal = -Infinity, worstDay = null, worstVal = Infinity;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > bestVal) { bestVal = diff; bestDay = dayLabels[i]; }
    if (diff < worstVal) { worstVal = diff; worstDay = dayLabels[i]; }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your Weekly Trading Report</title>
</head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E1A;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#111827,#1A2235);border-radius:16px 16px 0 0;padding:32px 32px 24px;border-bottom:1px solid #1A2235;">
          <p style="margin:0 0 8px;font-size:13px;color:#00B3E6;font-weight:600;letter-spacing:1px;text-transform:uppercase;">CapitalQuest</p>
          <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;color:#F1F5F9;">Your Weekly Trading Report 📈</h1>
          <p style="margin:0;font-size:14px;color:#94A3B8;">Week ending ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="background:#111827;padding:24px 32px 0;">
          <p style="margin:0;font-size:16px;color:#F1F5F9;">Hey <strong>${user.displayName}</strong> 👋</p>
          <p style="margin:8px 0 0;font-size:14px;color:#94A3B8;line-height:1.6;">
            Here's how your virtual portfolio performed this week.
          </p>
        </td></tr>

        <!-- Stats row -->
        <tr><td style="background:#111827;padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%" style="background:#1A2235;border-radius:12px;padding:16px 20px;border:1px solid #1E293B;">
                <p style="margin:0 0 4px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.8px;">Portfolio Value</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:#F1F5F9;">${formatCurrency(currentValue)}</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#1A2235;border-radius:12px;padding:16px 20px;border:1px solid #1E293B;">
                <p style="margin:0 0 4px;font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.8px;">This Week</p>
                <p style="margin:0;font-size:22px;font-weight:800;color:${gainColor};">
                  ${gainArrow} ${formatCurrency(Math.abs(weeklyGain))}
                </p>
                <p style="margin:2px 0 0;font-size:12px;color:${gainColor};">${formatPercent(weeklyGainPct)}</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Summary sentence -->
        <tr><td style="background:#111827;padding:0 32px 20px;">
          <p style="margin:0;font-size:14px;color:#94A3B8;line-height:1.6;">
            You <strong style="color:${gainColor};">${gainLabel} ${formatCurrency(Math.abs(weeklyGain))}</strong> this week
            (${formatPercent(weeklyGainPct)}).
            ${bestDay ? `Your best day was <strong style="color:#F1F5F9;">${bestDay}</strong> (+${formatCurrency(Math.max(0, bestVal))}).` : ''}
          </p>
        </td></tr>

        <!-- Market News Recap -->
        <tr><td style="background:#111827;padding:0 32px 20px;">
          <div style="background:#1A2235;border-radius:12px;padding:16px 20px;border:1px solid #1E293B;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#00B3E6;text-transform:uppercase;letter-spacing:0.8px;">
              📰 Market Recap
            </p>
            <p style="margin:0;font-size:13px;color:#CBD5E1;line-height:1.7;">
              ${marketRecap}
            </p>
          </div>
        </td></tr>

        <!-- Chart -->
        <tr><td style="background:#111827;padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.8px;">7-Day Performance</p>
          <img src="${chartUrl}" width="100%" style="max-width:496px;border-radius:12px;border:1px solid #1A2235;display:block;" alt="Weekly performance chart"/>
        </td></tr>

        <!-- Day-by-day breakdown -->
        <tr><td style="background:#111827;padding:0 32px 28px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.8px;">Daily Breakdown</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${dayLabels.map((day, i) => {
              const val = values[i];
              const prev = i > 0 ? values[i - 1] : val;
              const diff = val - prev;
              const dc = diff >= 0 ? '#00C853' : '#FF3D57';
              const da = diff >= 0 ? '▲' : '▼';
              return `<tr>
                <td style="padding:7px 0;font-size:13px;color:#94A3B8;border-bottom:1px solid #1A2235;">${day}</td>
                <td style="padding:7px 0;font-size:13px;color:#F1F5F9;text-align:right;border-bottom:1px solid #1A2235;">${formatCurrency(val)}</td>
                <td style="padding:7px 0;font-size:12px;color:${dc};text-align:right;width:80px;border-bottom:1px solid #1A2235;">${i === 0 ? '—' : `${da} ${formatCurrency(Math.abs(diff))}`}</td>
              </tr>`;
            }).join('')}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:#111827;padding:0 32px 32px;text-align:center;">
          <a href="https://capitalquest.co" style="display:inline-block;background:linear-gradient(90deg,#00B3E6,#0096C7);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:12px;">
            Open CapitalQuest →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0D1117;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #1A2235;text-align:center;">
          <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
            CapitalQuest · Virtual Stock Trading · No real money involved<br/>
            You're receiving this because you have a CapitalQuest account.<br/>
            <a href="https://capitalquest.co" style="color:#00B3E6;text-decoration:none;">capitalquest.co</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Fetch a brief market recap by checking major index performance
async function getMarketRecap() {
  try {
    const indices = [
      { symbol: '^GSPC', name: 'S&P 500' },
      { symbol: '^DJI', name: 'Dow Jones' },
      { symbol: '^IXIC', name: 'Nasdaq' },
    ];

    const results = [];
    for (const idx of indices) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.symbol)}?interval=1d&range=5d&includePrePost=false`;
      const resp = await fetch(url);
      const data = await resp.json();
      const closes = data.chart.result[0].indicators.quote[0].close.filter(v => v != null);
      if (closes.length >= 2) {
        const start = closes[0];
        const end = closes[closes.length - 1];
        const pctChange = ((end - start) / start * 100).toFixed(1);
        results.push({ name: idx.name, pctChange: parseFloat(pctChange) });
      }
    }

    const summaries = results.map(r => {
      const dir = r.pctChange >= 0 ? 'up' : 'down';
      return `the ${r.name} ${dir} ${Math.abs(r.pctChange)}%`;
    });

    const overallDir = results.reduce((s, r) => s + r.pctChange, 0) >= 0 ? 'positive' : 'mixed';

    return `Markets had a ${overallDir} week overall, with ${summaries.join(', ')}. Keep an eye on earnings reports and economic data releases that could impact the markets in the coming week. Remember, this is a simulation \u2014 use it to learn and practice your trading strategies!`;
  } catch (err) {
    console.warn('Could not fetch market recap:', err.message);
    return 'Markets experienced movement this past week across major indices. Stay tuned for key economic releases and earnings reports that may shape market trends in the coming days. Remember, this is a simulation \u2014 use it to learn and practice your trading strategies!';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📧 Starting weekly email job...');

  const days = getLast7Days();
  const dayLabels = getDayLabels(days);

  // Fetch market recap once (shared across all emails)
  const marketRecap = await getMarketRecap();
  console.log(`📰 Market recap: ${marketRecap.substring(0, 80)}...`);

  // Fetch all users
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users`);

  let sent = 0, skipped = 0, errors = 0;

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();

    // Use notificationEmail (real email) if available, otherwise skip fake @capitalquest.app emails
    const sendTo = user.notificationEmail || user.email;
    if (!sendTo || sendTo.endsWith('@capitalquest.app')) { skipped++; continue; }

    try {
      // Fetch portfolio snapshots for the past 7 days
      const snapshotsRef = db
        .collection('portfolioHistory')
        .doc(userDoc.id)
        .collection('snapshots');

      const snapshots = {};
      for (const day of days) {
        const snap = await snapshotsRef.doc(day).get();
        if (snap.exists) snapshots[day] = snap.data().totalValue;
      }

      // Fetch current portfolio for latest value
      const portfolioDoc = await db.collection('portfolios').doc(userDoc.id).get();
      if (!portfolioDoc.exists) { skipped++; continue; }
      const portfolio = portfolioDoc.data();
      const currentValue = portfolio.totalValue || portfolio.startingBalance || 10000;

      // Fill in any missing days with the nearest known value
      const values = [];
      let lastKnown = currentValue;
      for (let i = days.length - 1; i >= 0; i--) {
        if (snapshots[days[i]] !== undefined) lastKnown = snapshots[days[i]];
        values[i] = lastKnown;
      }
      // Override today with current value
      values[days.length - 1] = currentValue;

      // Calculate weekly gain
      const weekStartValue = values[0];
      const weeklyGain = currentValue - weekStartValue;
      const weeklyGainPct = weekStartValue > 0
        ? (weeklyGain / weekStartValue) * 100
        : 0;

      // Build chart
      const chartUrl = buildChartUrl(dayLabels, values, weeklyGain >= 0);

      // Build & send email
      const html = buildEmail(user, weeklyGain, weeklyGainPct, currentValue, chartUrl, dayLabels, values, marketRecap);

      await resend.emails.send({
        from: 'CapitalQuest <reports@capitalquest.co>',
        to: sendTo,
        subject: `Your Weekly Report ${weeklyGain >= 0 ? '📈' : '📉'} ${weeklyGain >= 0 ? '+' : ''}${formatCurrency(weeklyGain)} this week`,
        html,
      });

      console.log(`✅ Sent to ${sendTo} (${formatCurrency(weeklyGain)} this week)`);
      sent++;

    } catch (err) {
      console.error(`❌ Failed for ${sendTo}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Done — ${sent} sent, ${skipped} skipped, ${errors} errors`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
