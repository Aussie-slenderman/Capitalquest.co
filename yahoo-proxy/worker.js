/**
 * Cloudflare Worker — CORS proxy for Yahoo Finance + Finnhub.
 *
 * Routes:
 *   /                           → Yahoo Finance proxy (uses ?url=...)
 *   /finnhub/<endpoint>?...     → Finnhub proxy (key injected server-side)
 *
 * Finnhub key is read from env.FINNHUB_KEY (set via `wrangler secret put FINNHUB_KEY`).
 *
 * Free tier: 100,000 requests / day.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Simple in-memory rate limiter ──────────────────────────────────────────
// Per-IP sliding window, not globally durable. For stricter limits across
// edges, upgrade to Durable Objects or KV.
const rateLimitBuckets = new Map();
const RATE_LIMIT_MAX = 40;      // requests
const RATE_LIMIT_WINDOW = 60_000; // per minute

function rateLimit(ip) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip) || [];
  const fresh = bucket.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (fresh.length >= RATE_LIMIT_MAX) {
    return false;
  }
  fresh.push(now);
  rateLimitBuckets.set(ip, fresh);
  return true;
}

async function handleFinnhub(url, env, ip) {
  if (!env.FINNHUB_KEY) {
    return jsonError('FINNHUB_KEY not configured on worker', 500);
  }
  if (!rateLimit(ip)) {
    return jsonError('Rate limit exceeded', 429);
  }

  // /finnhub/quote?symbol=AAPL  →  https://finnhub.io/api/v1/quote?symbol=AAPL&token=XXX
  const endpoint = url.pathname.replace(/^\/finnhub/, '');
  if (!endpoint || endpoint === '/') {
    return jsonError('Missing endpoint');
  }

  const upstream = new URL('https://finnhub.io/api/v1' + endpoint);
  // Forward all query params except any client-supplied token
  url.searchParams.forEach((v, k) => {
    if (k.toLowerCase() !== 'token') upstream.searchParams.set(k, v);
  });
  upstream.searchParams.set('token', env.FINNHUB_KEY);

  try {
    const resp = await fetch(upstream.toString(), {
      headers: { 'Accept': 'application/json' },
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
        // Cache Finnhub responses briefly at the edge
        'Cache-Control': 'public, max-age=15',
      },
    });
  } catch (err) {
    return jsonError(`Finnhub fetch failed: ${err.message}`, 502);
  }
}

async function handleYahoo(url) {
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonError('Missing ?url= parameter');
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return jsonError('Invalid URL');
  }

  const allowed = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'finance.yahoo.com'];
  if (!allowed.includes(targetUrl.hostname)) {
    return jsonError('Only Yahoo Finance URLs allowed', 403);
  }

  try {
    const resp = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json, */*',
      },
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'application/json',
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (err) {
    return jsonError(`Fetch failed: ${err.message}`, 502);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (url.pathname.startsWith('/finnhub')) {
      return handleFinnhub(url, env, ip);
    }

    return handleYahoo(url);
  },
};
