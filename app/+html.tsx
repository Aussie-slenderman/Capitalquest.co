import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * HTML wrapper rendered only on the web.
 * All <head> meta tags here are indexed by Google and social crawlers.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* ── Primary SEO ── */}
        <title>Rookie Markets — Free Virtual Stock Trading Simulator</title>
        <meta
          name="title"
          content="Rookie Markets — Free Virtual Stock Trading Simulator"
        />
        <meta
          name="description"
          content="Master the stock market risk-free on Rookie Markets. Trade with real-time prices, climb global leaderboards, earn achievements, and level up your investing skills — completely free."
        />
        <meta
          name="keywords"
          content="stock trading simulator, virtual trading, paper trading, practice investing, stock market game, learn to invest, free trading app, investing for beginners, stock market simulator"
        />
        <meta name="author" content="Rookie Markets" />
        <meta name="robots" content="index, follow" />
        <meta name="theme-color" content="#0A0E1A" />

        {/* ── Canonical URL (update when domain is live) ── */}
        <link rel="canonical" href="https://capitalquest.app/" />

        {/* ── Open Graph (Facebook / LinkedIn / Discord) ── */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Rookie Markets" />
        <meta property="og:url" content="https://capitalquest.app/" />
        <meta
          property="og:title"
          content="Rookie Markets — Free Virtual Stock Trading Simulator"
        />
        <meta
          property="og:description"
          content="Master the stock market risk-free. Trade with real-time prices, compete on leaderboards, and level up your investing skills — completely free."
        />
        <meta
          property="og:image"
          content="https://capitalquest.app/og-image.png"
        />
        <meta property="og:locale" content="en_US" />

        {/* ── Twitter Card ── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@rookiemarkets" />
        <meta
          name="twitter:title"
          content="Rookie Markets — Free Virtual Stock Trading Simulator"
        />
        <meta
          name="twitter:description"
          content="Master the stock market risk-free. Trade with real-time prices, compete on leaderboards, and level up your investing skills — completely free."
        />
        <meta
          name="twitter:image"
          content="https://capitalquest.app/og-image.png"
        />

        {/* ── JSON-LD Structured Data (Google rich results) ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Rookie Markets',
              url: 'https://capitalquest.app',
              description:
                'A free virtual stock trading simulator where players trade with real-time prices, compete on leaderboards, and learn investing skills risk-free.',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web, iOS, Android',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '1200',
              },
            }),
          }}
        />

        {/* Expo web resets */}
        <ScrollViewStyleReset />

        {/* Prevent flash of un-styled content on dark theme */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; background-color: #0A0E1A; }
              * { box-sizing: border-box; }
              ::-webkit-scrollbar { width: 6px; }
              ::-webkit-scrollbar-track { background: #111827; }
              ::-webkit-scrollbar-thumb { background: #1A2235; border-radius: 3px; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
