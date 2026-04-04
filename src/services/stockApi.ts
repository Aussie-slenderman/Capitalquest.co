/**
 * Stock API Service
 *
 * Uses Finnhub (free tier) as primary source for real-time quotes.
 * Falls back to Alpha Vantage for historical chart data.
 *
 * To get API keys:
 *   Finnhub:      https://finnhub.io   (free: 60 calls/min)
 *   Alpha Vantage: https://alphavantage.co (free: 5 calls/min, 500/day)
 *
 * Replace the placeholder keys below with your actual keys.
 * Without keys, the app uses realistic mock data so you can still trade!
 */

import axios from 'axios';
import { Platform } from 'react-native';
import type { Stock, StockQuote, ChartDataPoint, ChartPeriod, NewsArticle } from '../types';

const FINNHUB_KEY = 'YOUR_FINNHUB_API_KEY';
const ALPHA_KEY = 'YOUR_ALPHAVANTAGE_API_KEY';

// ─── Mock mode ────────────────────────────────────────────────────────────────

export const IS_MOCK_STOCKS = FINNHUB_KEY === 'YOUR_FINNHUB_API_KEY';

// Comprehensive mock stock database — 60+ tickers (prices: verified March 13 2026 close)
// These are used as fallback when Yahoo Finance / Finnhub are unavailable.
const MOCK_DB: Record<string, { name: string; price: number; changePercent: number; sector: string; exchange: string; marketCap: number }> = {
  // US Big Tech — prices updated April 2 2026
  AAPL: { name: 'Apple Inc', price: 255.43, changePercent: -0.08, sector: 'Technology', exchange: 'NASDAQ', marketCap: 3780e9 },
  MSFT: { name: 'Microsoft Corp', price: 371.34, changePercent: 0.53, sector: 'Technology', exchange: 'NASDAQ', marketCap: 2940e9 },
  GOOGL: { name: 'Alphabet Inc', price: 295.61, changePercent: -0.60, sector: 'Technology', exchange: 'NASDAQ', marketCap: 3720e9 },
  GOOG: { name: 'Alphabet Inc (C)', price: 297.00, changePercent: -0.58, sector: 'Technology', exchange: 'NASDAQ', marketCap: 3720e9 },
  AMZN: { name: 'Amazon.com Inc', price: 209.26, changePercent: -0.62, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 2210e9 },
  META: { name: 'Meta Platforms Inc', price: 573.57, changePercent: -0.98, sector: 'Technology', exchange: 'NASDAQ', marketCap: 1560e9 },
  NVDA: { name: 'NVIDIA Corp', price: 176.93, changePercent: 0.67, sector: 'Technology', exchange: 'NASDAQ', marketCap: 4400e9 },
  TSLA: { name: 'Tesla Inc', price: 359.84, changePercent: -5.62, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 1250e9 },
  NFLX: { name: 'Netflix Inc', price: 97.81, changePercent: 2.37, sector: 'Communication Services', exchange: 'NASDAQ', marketCap: 422e9 },
  INTC: { name: 'Intel Corp', price: 49.91, changePercent: 3.90, sector: 'Technology', exchange: 'NASDAQ', marketCap: 196e9 },
  AMD: { name: 'Advanced Micro Devices', price: 216.53, changePercent: 3.00, sector: 'Technology', exchange: 'NASDAQ', marketCap: 313e9 },
  ORCL: { name: 'Oracle Corp', price: 145.93, changePercent: 0.48, sector: 'Technology', exchange: 'NYSE', marketCap: 535e9 },
  CRM: { name: 'Salesforce Inc', price: 186.25, changePercent: 0.01, sector: 'Technology', exchange: 'NYSE', marketCap: 285e9 },
  ADBE: { name: 'Adobe Inc', price: 242.46, changePercent: 0.45, sector: 'Technology', exchange: 'NASDAQ', marketCap: 198e9 },
  PYPL: { name: 'PayPal Holdings', price: 45.23, changePercent: 1.34, sector: 'Financials', exchange: 'NASDAQ', marketCap: 78e9 },
  // US Finance
  JPM: { name: 'JPMorgan Chase & Co', price: 294.39, changePercent: -0.34, sector: 'Financials', exchange: 'NYSE', marketCap: 812e9 },
  BAC: { name: 'Bank of America Corp', price: 49.28, changePercent: 0.01, sector: 'Financials', exchange: 'NYSE', marketCap: 365e9 },
  GS: { name: 'Goldman Sachs Group', price: 862.23, changePercent: 0.23, sector: 'Financials', exchange: 'NYSE', marketCap: 196e9 },
  V: { name: 'Visa Inc', price: 301.36, changePercent: 0.95, sector: 'Financials', exchange: 'NYSE', marketCap: 626e9 },
  MA: { name: 'Mastercard Inc', price: 493.97, changePercent: 0.47, sector: 'Financials', exchange: 'NYSE', marketCap: 525e9 },
  BRK_B: { name: 'Berkshire Hathaway B', price: 476.76, changePercent: -0.36, sector: 'Financials', exchange: 'NYSE', marketCap: 1110e9 },
  // US Healthcare
  JNJ: { name: 'Johnson & Johnson', price: 243.23, changePercent: -0.36, sector: 'Healthcare', exchange: 'NYSE', marketCap: 392e9 },
  PFE: { name: 'Pfizer Inc', price: 28.39, changePercent: -0.56, sector: 'Healthcare', exchange: 'NYSE', marketCap: 144e9 },
  UNH: { name: 'UnitedHealth Group', price: 275.68, changePercent: 0.62, sector: 'Healthcare', exchange: 'NYSE', marketCap: 481e9 },
  ABBV: { name: 'AbbVie Inc', price: 209.15, changePercent: -2.71, sector: 'Healthcare', exchange: 'NYSE', marketCap: 356e9 },
  MRK: { name: 'Merck & Co Inc', price: 120.18, changePercent: -0.55, sector: 'Healthcare', exchange: 'NYSE', marketCap: 228e9 },
  // US Consumer
  WMT: { name: 'Walmart Inc', price: 125.49, changePercent: 0.60, sector: 'Consumer Staples', exchange: 'NYSE', marketCap: 746e9 },
  AMZN_RETAIL: { name: 'Amazon Consumer', price: 209.26, changePercent: -0.62, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 2210e9 },
  MCD: { name: "McDonald's Corp", price: 307.35, changePercent: 0.02, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 206e9 },
  KO: { name: 'Coca-Cola Co', price: 76.76, changePercent: 0.89, sector: 'Consumer Staples', exchange: 'NYSE', marketCap: 301e9 },
  PEP: { name: 'PepsiCo Inc', price: 155.93, changePercent: 0.83, sector: 'Consumer Staples', exchange: 'NASDAQ', marketCap: 192e9 },
  NKE: { name: 'Nike Inc', price: 43.91, changePercent: -1.62, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 81e9 },
  SBUX: { name: 'Starbucks Corp', price: 90.48, changePercent: 0.06, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 107e9 },
  // US Energy
  XOM: { name: 'Exxon Mobil Corp', price: 161.43, changePercent: 0.40, sector: 'Energy', exchange: 'NYSE', marketCap: 625e9 },
  CVX: { name: 'Chevron Corp', price: 198.84, changePercent: 0.72, sector: 'Energy', exchange: 'NYSE', marketCap: 272e9 },
  // US Industrial / Other
  BA: { name: 'Boeing Co', price: 207.58, changePercent: 0.13, sector: 'Industrials', exchange: 'NYSE', marketCap: 105e9 },
  GE: { name: 'GE Aerospace', price: 281.90, changePercent: -3.68, sector: 'Industrials', exchange: 'NYSE', marketCap: 221e9 },
  UBER: { name: 'Uber Technologies', price: 71.70, changePercent: -0.01, sector: 'Technology', exchange: 'NYSE', marketCap: 152e9 },
  SPOT: { name: 'Spotify Technology', price: 487.79, changePercent: 3.78, sector: 'Communication Services', exchange: 'NYSE', marketCap: 126e9 },
  SHOP: { name: 'Shopify Inc', price: 118.39, changePercent: -0.11, sector: 'Technology', exchange: 'NYSE', marketCap: 156e9 },
  SQ: { name: 'Block Inc', price: 57.44, changePercent: -0.77, sector: 'Financials', exchange: 'NYSE', marketCap: 35e9 },
  COIN: { name: 'Coinbase Global', price: 171.70, changePercent: -0.75, sector: 'Financials', exchange: 'NASDAQ', marketCap: 48e9 },
  ARM: { name: 'Arm Holdings plc', price: 148.33, changePercent: -4.35, sector: 'Technology', exchange: 'NASDAQ', marketCap: 122e9 },
  SMCI: { name: 'Super Micro Computer', price: 23.16, changePercent: 2.87, sector: 'Technology', exchange: 'NASDAQ', marketCap: 18e9 },
  // ETFs
  SPY: { name: 'SPDR S&P 500 ETF', price: 654.64, changePercent: -0.09, sector: 'ETF', exchange: 'NYSE', marketCap: 620e9 },
  QQQ: { name: 'Invesco QQQ Trust', price: 583.28, changePercent: -0.18, sector: 'ETF', exchange: 'NASDAQ', marketCap: 295e9 },
  IWM: { name: 'iShares Russell 2000', price: 250.86, changePercent: 0.52, sector: 'ETF', exchange: 'NYSE', marketCap: 55e9 },
  VTI: { name: 'Vanguard Total Stock ETF', price: 323.21, changePercent: -0.01, sector: 'ETF', exchange: 'NYSE', marketCap: 460e9 },
  GLD: { name: 'SPDR Gold Shares', price: 429.63, changePercent: -1.87, sector: 'Commodity ETF', exchange: 'NYSE', marketCap: 76e9 },
  // UK / International
  HSBA: { name: 'HSBC Holdings plc', price: 9.12, changePercent: 0.33, sector: 'Financials', exchange: 'LSE', marketCap: 174e9 },
  VOD: { name: 'Vodafone Group plc', price: 0.72, changePercent: -0.28, sector: 'Communication Services', exchange: 'LSE', marketCap: 19e9 },
  BP: { name: 'BP plc', price: 4.44, changePercent: -0.66, sector: 'Energy', exchange: 'LSE', marketCap: 86e9 },
  SHEL: { name: 'Shell plc', price: 27.55, changePercent: -0.44, sector: 'Energy', exchange: 'LSE', marketCap: 213e9 },
  RIO: { name: 'Rio Tinto plc', price: 57.22, changePercent: 1.11, sector: 'Materials', exchange: 'LSE', marketCap: 93e9 },
  // Gaming / Entertainment
  ATVI: { name: 'Activision Blizzard', price: 95.22, changePercent: 0.11, sector: 'Communication Services', exchange: 'NASDAQ', marketCap: 74e9 },
  EA: { name: 'Electronic Arts Inc', price: 122.88, changePercent: -0.44, sector: 'Communication Services', exchange: 'NASDAQ', marketCap: 32e9 },
  RBLX: { name: 'Roblox Corp', price: 56.42, changePercent: -1.33, sector: 'Communication Services', exchange: 'NYSE', marketCap: 35e9 },
  DIS: { name: 'Walt Disney Co', price: 99.29, changePercent: -0.77, sector: 'Communication Services', exchange: 'NYSE', marketCap: 180e9 },
  // Real Estate & Utilities
  AMT: { name: 'American Tower Corp', price: 178.88, changePercent: -0.33, sector: 'Real Estate', exchange: 'NYSE', marketCap: 83e9 },
  NEE: { name: 'NextEra Energy Inc', price: 68.22, changePercent: 0.22, sector: 'Utilities', exchange: 'NYSE', marketCap: 139e9 },
  // Popular retail names
  WBA: { name: 'Walgreens Boots Alliance', price: 9.88, changePercent: -2.11, sector: 'Consumer Staples', exchange: 'NASDAQ', marketCap: 8.5e9 },
  CVS: { name: 'CVS Health Corp', price: 44.77, changePercent: -1.22, sector: 'Healthcare', exchange: 'NYSE', marketCap: 57e9 },
  T: { name: 'AT&T Inc', price: 25.88, changePercent: 0.44, sector: 'Communication Services', exchange: 'NYSE', marketCap: 185e9 },
  VZ: { name: 'Verizon Communications', price: 44.22, changePercent: 0.22, sector: 'Communication Services', exchange: 'NYSE', marketCap: 186e9 },
  // European stocks
  ASML: { name: 'ASML Holding NV', price: 712.44, changePercent: -1.22, sector: 'Technology', exchange: 'NASDAQ', marketCap: 280e9 },
  SAP: { name: 'SAP SE', price: 228.33, changePercent: 0.44, sector: 'Technology', exchange: 'NYSE', marketCap: 279e9 },
  LVMH: { name: 'LVMH Moët Hennessy', price: 142.55, changePercent: -0.88, sector: 'Consumer Discretionary', exchange: 'EPA', marketCap: 356e9 },
  TTE: { name: 'TotalEnergies SE', price: 58.22, changePercent: -0.33, sector: 'Energy', exchange: 'EPA', marketCap: 139e9 },
  SIE: { name: 'Siemens AG', price: 198.44, changePercent: 0.66, sector: 'Industrials', exchange: 'ETR', marketCap: 158e9 },
  BAS: { name: 'BASF SE', price: 44.77, changePercent: -1.11, sector: 'Materials', exchange: 'ETR', marketCap: 40e9 },
  ALV: { name: 'Allianz SE', price: 299.55, changePercent: 0.33, sector: 'Financials', exchange: 'ETR', marketCap: 130e9 },
  DBK: { name: 'Deutsche Bank AG', price: 16.44, changePercent: -0.55, sector: 'Financials', exchange: 'ETR', marketCap: 34e9 },
  MC: { name: 'LVMH (Paris)', price: 652.44, changePercent: -0.88, sector: 'Consumer Discretionary', exchange: 'EPA', marketCap: 325e9 },
  OR: { name: "L'Oréal SA", price: 388.22, changePercent: 0.22, sector: 'Consumer Staples', exchange: 'EPA', marketCap: 208e9 },
  BNP: { name: 'BNP Paribas SA', price: 66.88, changePercent: -0.44, sector: 'Financials', exchange: 'EPA', marketCap: 81e9 },
  AZN: { name: 'AstraZeneca plc', price: 72.44, changePercent: 0.55, sector: 'Healthcare', exchange: 'NASDAQ', marketCap: 226e9 },
  GSK: { name: 'GSK plc', price: 37.22, changePercent: -0.33, sector: 'Healthcare', exchange: 'NYSE', marketCap: 75e9 },
  ULVR: { name: 'Unilever plc', price: 50.33, changePercent: 0.11, sector: 'Consumer Staples', exchange: 'LSE', marketCap: 126e9 },
  DGE: { name: 'Diageo plc', price: 25.88, changePercent: -0.66, sector: 'Consumer Staples', exchange: 'LSE', marketCap: 65e9 },
  LLOY: { name: 'Lloyds Banking Group', price: 0.55, changePercent: 0.91, sector: 'Financials', exchange: 'LSE', marketCap: 39e9 },
  BARC: { name: 'Barclays plc', price: 2.44, changePercent: 1.22, sector: 'Financials', exchange: 'LSE', marketCap: 44e9 },
  RR: { name: 'Rolls-Royce Holdings', price: 6.88, changePercent: 1.55, sector: 'Industrials', exchange: 'LSE', marketCap: 63e9 },
  // Asian stocks (US-listed ADRs and direct)
  TSM: { name: 'Taiwan Semiconductor', price: 339.05, changePercent: -0.72, sector: 'Technology', exchange: 'NYSE', marketCap: 953e9 },
  BABA: { name: 'Alibaba Group', price: 121.80, changePercent: -1.56, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 332e9 },
  JD: { name: 'JD.com Inc', price: 44.22, changePercent: 1.55, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 68e9 },
  PDD: { name: 'PDD Holdings (Temu)', price: 122.44, changePercent: 0.88, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 171e9 },
  BIDU: { name: 'Baidu Inc', price: 88.55, changePercent: 1.22, sector: 'Technology', exchange: 'NASDAQ', marketCap: 31e9 },
  NIO: { name: 'NIO Inc', price: 4.55, changePercent: -2.22, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 9.3e9 },
  XPEV: { name: 'XPeng Inc', price: 22.88, changePercent: -1.55, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 20e9 },
  LI: { name: 'Li Auto Inc', price: 28.33, changePercent: -1.11, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 30e9 },
  TM: { name: 'Toyota Motor Corp', price: 197.44, changePercent: -0.44, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 282e9 },
  HMC: { name: 'Honda Motor Co', price: 28.88, changePercent: -0.66, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 48e9 },
  SONY: { name: 'Sony Group Corp', price: 18.44, changePercent: 0.33, sector: 'Technology', exchange: 'NYSE', marketCap: 113e9 },
  NTDOY: { name: 'Nintendo Co Ltd', price: 13.22, changePercent: 0.22, sector: 'Communication Services', exchange: 'OTC', marketCap: 174e9 },
  SNE: { name: 'Sony (ADR)', price: 94.77, changePercent: 0.55, sector: 'Technology', exchange: 'NYSE', marketCap: 118e9 },
  SoftBank: { name: 'SoftBank Group Corp', price: 9.88, changePercent: 1.44, sector: 'Technology', exchange: 'OTC', marketCap: 85e9 },
  // Indian stocks (US-listed)
  INFY: { name: 'Infosys Ltd', price: 18.88, changePercent: -0.33, sector: 'Technology', exchange: 'NYSE', marketCap: 79e9 },
  WIT: { name: 'Wipro Ltd', price: 6.44, changePercent: 0.16, sector: 'Technology', exchange: 'NYSE', marketCap: 33e9 },
  HDB: { name: 'HDFC Bank Ltd', price: 62.22, changePercent: 0.44, sector: 'Financials', exchange: 'NYSE', marketCap: 169e9 },
  IBN: { name: 'ICICI Bank Ltd', price: 26.44, changePercent: 0.88, sector: 'Financials', exchange: 'NYSE', marketCap: 94e9 },
  // Australian stocks
  BHP: { name: 'BHP Group Ltd', price: 57.44, changePercent: 0.55, sector: 'Materials', exchange: 'NYSE', marketCap: 142e9 },
  // Canadian stocks
  SHOP_CA: { name: 'Shopify Inc (CA)', price: 122.96, changePercent: -2.54, sector: 'Technology', exchange: 'TSX', marketCap: 156e9 },
  CNR: { name: 'Canadian National Railway', price: 128.44, changePercent: -0.22, sector: 'Industrials', exchange: 'NYSE', marketCap: 91e9 },
  // LatAm
  MELI: { name: 'MercadoLibre Inc', price: 2188.44, changePercent: -1.33, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 110e9 },
  NU: { name: 'Nu Holdings Ltd', price: 12.88, changePercent: 1.11, sector: 'Financials', exchange: 'NYSE', marketCap: 62e9 },
  // Crypto-adjacent / high-interest
  MSTR: { name: 'MicroStrategy Inc', price: 119.61, changePercent: -2.58, sector: 'Technology', exchange: 'NASDAQ', marketCap: 33e9 },
  MARA: { name: 'Marathon Digital Holdings', price: 14.22, changePercent: -4.55, sector: 'Technology', exchange: 'NASDAQ', marketCap: 3.5e9 },
  RIOT: { name: 'Riot Platforms Inc', price: 8.44, changePercent: -3.22, sector: 'Technology', exchange: 'NASDAQ', marketCap: 2.5e9 },
  // Additional popular US
  PLTR: { name: 'Palantir Technologies', price: 147.62, changePercent: 0.77, sector: 'Technology', exchange: 'NYSE', marketCap: 213e9 },
  AI: { name: 'C3.ai Inc', price: 26.88, changePercent: -1.66, sector: 'Technology', exchange: 'NYSE', marketCap: 3.5e9 },
  PATH: { name: 'UiPath Inc', price: 12.44, changePercent: -1.11, sector: 'Technology', exchange: 'NYSE', marketCap: 7.2e9 },
  SNOW: { name: 'Snowflake Inc', price: 152.48, changePercent: -0.42, sector: 'Technology', exchange: 'NYSE', marketCap: 49e9 },
  DDOG: { name: 'Datadog Inc', price: 119.92, changePercent: 1.05, sector: 'Technology', exchange: 'NASDAQ', marketCap: 36e9 },
  CRWD: { name: 'CrowdStrike Holdings', price: 396.42, changePercent: 0.79, sector: 'Technology', exchange: 'NASDAQ', marketCap: 94e9 },
  ABNB: { name: 'Airbnb Inc', price: 124.72, changePercent: -0.38, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 81e9 },
  LYFT: { name: 'Lyft Inc', price: 14.88, changePercent: 0.54, sector: 'Technology', exchange: 'NASDAQ', marketCap: 6.4e9 },
  DASH: { name: 'DoorDash Inc', price: 177.44, changePercent: -0.33, sector: 'Technology', exchange: 'NYSE', marketCap: 74e9 },
  HOOD: { name: 'Robinhood Markets', price: 68.98, changePercent: -1.61, sector: 'Financials', exchange: 'NASDAQ', marketCap: 38e9 },
  SOFI: { name: 'SoFi Technologies', price: 15.79, changePercent: 0.99, sector: 'Financials', exchange: 'NASDAQ', marketCap: 13e9 },
  GME: { name: 'GameStop Corp', price: 23.19, changePercent: 1.87, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 12e9 },
  AMC: { name: 'AMC Entertainment', price: 1.08, changePercent: 5.05, sector: 'Communication Services', exchange: 'NYSE', marketCap: 1.3e9 },
  RIVN: { name: 'Rivian Automotive', price: 15.37, changePercent: 2.88, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 13e9 },
  LCID: { name: 'Lucid Group Inc', price: 2.77, changePercent: -1.44, sector: 'Consumer Discretionary', exchange: 'NASDAQ', marketCap: 7.3e9 },
  F: { name: 'Ford Motor Co', price: 11.59, changePercent: -0.81, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 39e9 },
  GM: { name: 'General Motors Co', price: 72.74, changePercent: -3.07, sector: 'Consumer Discretionary', exchange: 'NYSE', marketCap: 44e9 },
  // Pharma / Biotech
  LLY: { name: 'Eli Lilly and Co', price: 935.11, changePercent: -2.03, sector: 'Healthcare', exchange: 'NYSE', marketCap: 748e9 },
  NVO: { name: 'Novo Nordisk A/S', price: 36.76, changePercent: 0.75, sector: 'Healthcare', exchange: 'NYSE', marketCap: 322e9 },
  AMGN: { name: 'Amgen Inc', price: 348.33, changePercent: -1.40, sector: 'Healthcare', exchange: 'NASDAQ', marketCap: 137e9 },
  GILD: { name: 'Gilead Sciences Inc', price: 99.88, changePercent: 0.33, sector: 'Healthcare', exchange: 'NASDAQ', marketCap: 123e9 },
  BIIB: { name: 'Biogen Inc', price: 133.22, changePercent: -1.77, sector: 'Healthcare', exchange: 'NASDAQ', marketCap: 19e9 },
  REGN: { name: 'Regeneron Pharmaceuticals', price: 636.44, changePercent: -0.88, sector: 'Healthcare', exchange: 'NASDAQ', marketCap: 68e9 },
  // More ETFs
  ARKK: { name: 'ARK Innovation ETF', price: 44.88, changePercent: -2.33, sector: 'ETF', exchange: 'NYSE', marketCap: 7.8e9 },
  TLT: { name: 'iShares 20+ Yr Treasury', price: 88.44, changePercent: 0.22, sector: 'ETF', exchange: 'NASDAQ', marketCap: 55e9 },
  XLF: { name: 'Financial Select Sector', price: 48.22, changePercent: -0.66, sector: 'ETF', exchange: 'NYSE', marketCap: 43e9 },
  XLE: { name: 'Energy Select Sector', price: 93.44, changePercent: 0.88, sector: 'ETF', exchange: 'NYSE', marketCap: 38e9 },
  SLV: { name: 'iShares Silver Trust', price: 28.88, changePercent: 1.11, sector: 'Commodity ETF', exchange: 'NYSE', marketCap: 13e9 },
  // Market Indices (fallback values — updated April 2 2026)
  '^GSPC': { name: 'S&P 500', price: 6570.47, changePercent: -0.07, sector: 'Index', exchange: 'INDEX', marketCap: 0 },
  '^IXIC': { name: 'NASDAQ Composite', price: 21815.90, changePercent: -0.11, sector: 'Index', exchange: 'INDEX', marketCap: 0 },
  '^DJI': { name: 'Dow Jones Industrial Average', price: 46453.99, changePercent: -0.24, sector: 'Index', exchange: 'INDEX', marketCap: 0 },
  '^FTSE': { name: 'FTSE 100', price: 10436.29, changePercent: 0.69, sector: 'Index', exchange: 'INDEX', marketCap: 0 },
  '^GDAXI': { name: 'DAX', price: 23168.08, changePercent: -0.56, sector: 'Index', exchange: 'INDEX', marketCap: 0 },
  '^N225': { name: 'Nikkei 225', price: 52463.27, changePercent: -2.38, sector: 'Index', exchange: 'INDEX', marketCap: 0 },
};

function mockSeededPrice(symbol: string, base: number): number {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  // Daily trend: ±2% over the day
  const dayVariance   = Math.sin(Date.now() / 86_400_000 + seed) * 0.02;
  // Hourly fluctuation: ±0.8% per hour
  const hourVariance  = Math.sin(Date.now() / 3_600_000  + seed * 1.3) * 0.008;
  // Minute-level noise: ±0.15%
  const minuteNoise   = Math.sin(Date.now() / 60_000     + seed * 2.7) * 0.0015;
  return parseFloat((base * (1 + dayVariance + hourVariance + minuteNoise)).toFixed(2));
}

const EXCHANGE_INFO: Record<string, { country: string; currency: string }> = {
  NASDAQ: { country: 'US', currency: 'USD' },
  NYSE: { country: 'US', currency: 'USD' },
  LSE: { country: 'GB', currency: 'GBP' },
  EPA: { country: 'FR', currency: 'EUR' },
  ETR: { country: 'DE', currency: 'EUR' },
  TSX: { country: 'CA', currency: 'CAD' },
  OTC: { country: 'US', currency: 'USD' },
};

function getMockStock(symbol: string): Stock | null {
  const sym = symbol.toUpperCase();
  const entry = MOCK_DB[sym];
  if (!entry) return null;
  const price = mockSeededPrice(sym, entry.price);
  const change = parseFloat((price - entry.price).toFixed(2));
  const exInfo = EXCHANGE_INFO[entry.exchange] ?? { country: 'US', currency: 'USD' };
  return {
    symbol: sym,
    name: entry.name,
    exchange: entry.exchange,
    country: exInfo.country,
    currency: exInfo.currency,
    price,
    previousClose: entry.price,
    change,
    changePercent: entry.changePercent,
    volume: Math.floor(Math.random() * 50_000_000) + 1_000_000,
    marketCap: entry.marketCap,
    high52w: parseFloat((entry.price * 1.35).toFixed(2)),
    low52w: parseFloat((entry.price * 0.65).toFixed(2)),
    pe: entry.sector === 'ETF' ? undefined : parseFloat((15 + Math.random() * 30).toFixed(1)),
    eps: entry.sector === 'ETF' ? undefined : parseFloat((price / 25).toFixed(2)),
    sector: entry.sector,
    logoUrl: '',
    description: `${entry.name} is listed on ${entry.exchange}.`,
    isOpen: isMarketOpen(entry.exchange),
  };
}

function searchMockStocks(query: string): SearchResult[] {
  const q = query.toUpperCase().trim();
  if (!q) return [];
  return Object.entries(MOCK_DB)
    .filter(([sym, data]) =>
      sym.includes(q) ||
      data.name.toUpperCase().includes(q) ||
      data.sector.toUpperCase().includes(q) ||
      data.exchange.toUpperCase().includes(q)
    )
    .slice(0, 20)
    .map(([sym, data]) => ({
      symbol: sym,
      name: data.name,
      type: data.sector === 'ETF' ? 'ETF' : 'Common Stock',
      displaySymbol: sym,
    }));
}

function getMockQuote(symbol: string): StockQuote {
  const entry = MOCK_DB[symbol.toUpperCase()];
  if (!entry) return { symbol, price: 0, change: 0, changePercent: 0, timestamp: Date.now() };
  const price = mockSeededPrice(symbol, entry.price);
  return {
    symbol,
    price,
    change: parseFloat((price - entry.price).toFixed(2)),
    changePercent: entry.changePercent,
    timestamp: Date.now(),
  };
}

const MOCK_NEWS_TEMPLATES = [
  (sym: string, name: string) => ({
    headline: `${name} reports quarterly earnings that beat analyst expectations`,
    summary: `${name} (${sym}) posted earnings per share above consensus estimates, driven by strong revenue growth.`,
    source: 'Reuters',
  }),
  (sym: string, name: string) => ({
    headline: `Analysts raise price target for ${sym} citing strong fundamentals`,
    summary: `Wall Street analysts have upgraded their outlook for ${name}, pointing to improving margins and demand.`,
    source: 'Bloomberg',
  }),
  (sym: string, name: string) => ({
    headline: `${name} expands into new markets with strategic partnership`,
    summary: `${sym} announced a major strategic alliance that could open significant growth opportunities.`,
    source: 'WSJ',
  }),
  (sym: string, name: string) => ({
    headline: `${sym} stock moves on broader market sentiment and macro data`,
    summary: `${name} shares are reacting to broader economic signals including inflation data and central bank commentary.`,
    source: 'CNBC',
  }),
  (sym: string, name: string) => ({
    headline: `Institutional investors increase ${sym} holdings in latest filings`,
    summary: `13-F filings reveal that major funds have been accumulating ${name} shares over the past quarter.`,
    source: 'Barron\'s',
  }),
];

function getMockNews(symbol: string): NewsArticle[] {
  const entry = MOCK_DB[symbol.toUpperCase()];
  const name = entry?.name ?? symbol;
  return MOCK_NEWS_TEMPLATES.slice(0, 4).map((fn, i) => {
    const { headline, summary, source } = fn(symbol, name);
    return {
      id: `mock_${symbol}_${i}`,
      headline,
      summary,
      source,
      url: '#',
      publishedAt: Date.now() - i * 3_600_000,
      relatedSymbols: [symbol],
    };
  });
}

const finnhub = axios.create({
  baseURL: 'https://finnhub.io/api/v1',
  params: { token: FINNHUB_KEY },
  timeout: 10000,
});

// Yahoo Finance — same data Apple's Stocks app uses; no API key needed
// On web (browser), we route through our own Cloudflare Worker CORS proxy.
// On native iOS/Android, Yahoo Finance works directly (no CORS restrictions).
const YAHOO_BASE = 'https://query2.finance.yahoo.com';
const CQ_PROXY = 'https://cq-yahoo-proxy.capitalquest.workers.dev';
const YAHOO_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

// ─── Yahoo Finance session ──────────────────────────────────────────────────
// Crumb is NOT needed for v8/finance/chart — skip it entirely on web to avoid 401 spam.
// On native, we do the full cookie→crumb handshake.

let _yahooCrumb: string | null = null;
let _yahooCookie: string | null = null;
let _crumbExpiry = 0;

async function ensureYahooSession(): Promise<void> {
  if (Platform.OS === 'web') {
    // On web, skip crumb entirely — v8/chart works without it through our proxy
    return;
  }

  if (_yahooCrumb && Date.now() < _crumbExpiry) return;

  try {
    const cookieRes = await axios.get('https://finance.yahoo.com/', {
      timeout: 12_000,
      maxRedirects: 5,
      headers: {
        'User-Agent': YAHOO_MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const rawCookies = cookieRes.headers['set-cookie'];
    if (rawCookies) {
      const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
      _yahooCookie = cookies.map((c: string) => c.split(';')[0]).join('; ');
    }

    const crumbRes = await axios.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      timeout: 10_000,
      headers: {
        'User-Agent': YAHOO_MOBILE_UA,
        'Cookie': _yahooCookie ?? '',
        'Accept': '*/*',
      },
    });
    if (typeof crumbRes.data === 'string' && crumbRes.data.length > 0 && crumbRes.data !== 'null') {
      _yahooCrumb = crumbRes.data.trim();
      _crumbExpiry = Date.now() + 3_600_000;
    }
  } catch {
    _yahooCrumb = null;
  }
}

// CORS proxies — try our own Worker first, then public fallbacks
const CORS_PROXIES = [
  (url: string) => `${CQ_PROXY}?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithCorsProxy(url: string, timeout = 15_000): Promise<unknown> {
  const urls = [url];
  if (url.includes('query2.finance.yahoo.com')) {
    urls.push(url.replace('query2.finance.yahoo.com', 'query1.finance.yahoo.com'));
  } else if (url.includes('query1.finance.yahoo.com')) {
    urls.push(url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com'));
  }

  for (const proxyFn of CORS_PROXIES) {
    for (const u of urls) {
      const proxyUrl = proxyFn(u);

      // Try native fetch first (more reliable on web)
      if (typeof globalThis.fetch === 'function') {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);
          const res = await globalThis.fetch(proxyUrl, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            if (data) return data;
          }
        } catch { /* try next */ }
      }

      // Axios fallback
      try {
        const res = await axios.get(proxyUrl, { timeout });
        if (res.data) return res.data;
      } catch { /* try next */ }
    }
  }

  throw new Error('All CORS proxies failed');
}

async function yahooFetch(path: string, params?: Record<string, string | number | boolean>): Promise<unknown> {
  await ensureYahooSession();

  // Build query string — no crumb on web (not needed for v8/chart)
  const allParams: Record<string, string | number | boolean> = { ...params };
  if (_yahooCrumb && Platform.OS !== 'web') allParams['crumb'] = _yahooCrumb;

  const queryStr = Object.keys(allParams).length > 0
    ? '?' + Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const fullUrl = `${YAHOO_BASE}${path}${queryStr}`;

  if (Platform.OS === 'web') {
    return await fetchWithCorsProxy(fullUrl);
  } else {
    const res = await axios.get(fullUrl, {
      timeout: 12_000,
      headers: {
        'User-Agent': YAHOO_MOBILE_UA,
        'Accept': 'application/json, */*',
        ..._yahooCookie ? { 'Cookie': _yahooCookie } : {},
      },
    });
    return res.data;
  }
}

// ─── Yahoo Finance helpers ────────────────────────────────────────────────────

async function yahooGetQuote(symbol: string): Promise<StockQuote | null> {
  // Helper to extract quote from v8 chart response
  function parseQuoteFromChart(data: unknown): StockQuote | null {
    const d = data as Record<string, unknown>;
    const chart = d?.chart as Record<string, unknown> | undefined;
    const result = (chart?.result as Array<Record<string, unknown>> | undefined)?.[0];
    const meta = result?.meta as Record<string, unknown> | undefined;
    if (meta) {
      const price = Number(meta.regularMarketPrice ?? meta.previousClose ?? 0);
      const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
      const change = parseFloat((price - prevClose).toFixed(2));
      const changePercent = prevClose ? parseFloat(((change / prevClose) * 100).toFixed(2)) : 0;
      if (price > 0) {
        return { symbol, price, change, changePercent, timestamp: Date.now() };
      }
    }
    return null;
  }

  // Try v8 chart endpoint via yahooFetch (direct on native, CORS proxy on web)
  try {
    const data = await yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      interval: '1m', range: '1d',
    });
    const quote = parseQuoteFromChart(data);
    if (quote) return quote;
  } catch { /* fall through */ }

  // CORS proxy fallback — works on ALL platforms (web + native)
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const data = await fetchWithCorsProxy(chartUrl);
    const quote = parseQuoteFromChart(data);
    if (quote) return quote;
  } catch { /* fall through */ }

  return null;
}

async function yahooGetProfile(symbol: string): Promise<Stock | null> {
  try {
    const [chartData, summaryData] = await Promise.allSettled([
      yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}`, { interval: '1d', range: '5d' }),
      yahooFetch(`/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`, {
        modules: 'price,defaultKeyStatistics,assetProfile,financialData',
      }),
    ]);

    const meta = chartData.status === 'fulfilled'
      ? (chartData.value as Record<string, unknown> & { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })?.chart?.result?.[0]?.meta
      : null;
    const summary = summaryData.status === 'fulfilled'
      ? (summaryData.value as Record<string, unknown> & { quoteSummary?: { result?: unknown[] } })?.quoteSummary?.result?.[0] as Record<string, unknown> | undefined
      : null;

    if (!meta) {
      // Try v7 quotes endpoint as backup
      try {
        const v7Data = await yahooFetch('/v7/finance/quote', { symbols: symbol }) as Record<string, unknown>;
        const q = (v7Data?.quoteResponse as Record<string, unknown>)?.result as Record<string, unknown>[] | undefined;
        const quote = q?.[0];
        if (!quote) return getMockStock(symbol);
        return {
          symbol,
          name: String(quote.longName || quote.shortName || symbol),
          exchange: String(quote.exchangeName || quote.exchange || ''),
          country: String(quote.market || '').startsWith('gb') ? 'GB' : 'US',
          currency: String(quote.currency || 'USD'),
          price: Number(quote.regularMarketPrice ?? 0),
          previousClose: Number(quote.regularMarketPreviousClose ?? 0),
          change: Number(quote.regularMarketChange ?? 0),
          changePercent: Number(quote.regularMarketChangePercent ?? 0),
          volume: Number(quote.regularMarketVolume ?? 0),
          marketCap: Number(quote.marketCap ?? 0),
          high52w: Number(quote.fiftyTwoWeekHigh ?? 0),
          low52w: Number(quote.fiftyTwoWeekLow ?? 0),
          pe: quote.trailingPE != null ? Number(quote.trailingPE) : undefined,
          eps: quote.epsTrailingTwelveMonths != null ? Number(quote.epsTrailingTwelveMonths) : undefined,
          sector: String(quote.industry || quote.sector || ''),
          logoUrl: '',
          description: '',
          isOpen: quote.marketState === 'REGULAR',
        };
      } catch {
        return getMockStock(symbol);
      }
    }

    const price = Number((meta as Record<string, unknown>).regularMarketPrice ?? 0);
    const prevClose = Number((meta as Record<string, unknown>).chartPreviousClose ?? (meta as Record<string, unknown>).previousClose ?? price);
    const priceModule = summary?.price as Record<string, unknown> | undefined;
    const profile = summary?.assetProfile as Record<string, unknown> | undefined;

    return {
      symbol,
      name: String(
        (priceModule?.longName) || (priceModule?.shortName) ||
        (meta as Record<string, unknown>).symbol || symbol
      ),
      exchange: String((meta as Record<string, unknown>).exchangeName || (meta as Record<string, unknown>).exchange || ''),
      country: ((meta as Record<string, unknown>).currency === 'GBp' || (meta as Record<string, unknown>).currency === 'GBX') ? 'GB' : 'US',
      currency: ((meta as Record<string, unknown>).currency === 'GBp' || (meta as Record<string, unknown>).currency === 'GBX')
        ? 'GBP' : String((meta as Record<string, unknown>).currency || 'USD'),
      price,
      previousClose: prevClose,
      change: parseFloat((price - prevClose).toFixed(2)),
      changePercent: prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : 0,
      volume: Number((meta as Record<string, unknown>).regularMarketVolume ?? 0),
      marketCap: Number((priceModule?.marketCap as Record<string, unknown>)?.raw ?? 0),
      high52w: Number((meta as Record<string, unknown>).fiftyTwoWeekHigh ?? 0),
      low52w: Number((meta as Record<string, unknown>).fiftyTwoWeekLow ?? 0),
      pe: (summary?.defaultKeyStatistics as Record<string, unknown> | undefined)?.trailingPE != null
        ? Number(((summary?.defaultKeyStatistics as Record<string, unknown>)?.trailingPE as Record<string, unknown>)?.raw) : undefined,
      eps: (summary?.defaultKeyStatistics as Record<string, unknown> | undefined)?.trailingEps != null
        ? Number(((summary?.defaultKeyStatistics as Record<string, unknown>)?.trailingEps as Record<string, unknown>)?.raw) : undefined,
      sector: String(profile?.industry || profile?.sector || ''),
      logoUrl: '',
      description: String(profile?.longBusinessSummary || ''),
      isOpen: (meta as Record<string, unknown>).marketState === 'REGULAR',
    };
  } catch { /* fall through */ }

  // CORS proxy fallback — works on ALL platforms
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const data = await fetchWithCorsProxy(chartUrl) as Record<string, unknown>;
    const chart = data?.chart as Record<string, unknown> | undefined;
    const result = (chart?.result as Array<Record<string, unknown>> | undefined)?.[0];
    const meta = result?.meta as Record<string, unknown> | undefined;
    if (meta) {
      const price = Number(meta.regularMarketPrice ?? 0);
      const prevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
      if (price > 0) {
        const mockEntry = MOCK_DB[symbol.toUpperCase()];
        return {
          symbol,
          name: String(meta.shortName || meta.symbol || mockEntry?.name || symbol),
          exchange: String(meta.exchangeName || meta.exchange || mockEntry?.exchange || ''),
          country: (meta.currency === 'GBp' || meta.currency === 'GBX') ? 'GB' : 'US',
          currency: (meta.currency === 'GBp' || meta.currency === 'GBX') ? 'GBP' : String(meta.currency || 'USD'),
          price,
          previousClose: prevClose,
          change: parseFloat((price - prevClose).toFixed(2)),
          changePercent: prevClose ? parseFloat(((price - prevClose) / prevClose * 100).toFixed(2)) : 0,
          volume: Number(meta.regularMarketVolume ?? 0),
          marketCap: mockEntry?.marketCap ?? 0,
          high52w: Number(meta.fiftyTwoWeekHigh ?? 0),
          low52w: Number(meta.fiftyTwoWeekLow ?? 0),
          sector: mockEntry?.sector ?? '',
          logoUrl: '',
          description: '',
          isOpen: meta.marketState === 'REGULAR',
        };
      }
    }
  } catch { /* fall through */ }

  return getMockStock(symbol);
}

async function yahooSearch(query: string): Promise<SearchResult[]> {
  try {
    const data = await yahooFetch('/v1/finance/search', {
      q: query, lang: 'en-US', quotesCount: 10, newsCount: 0,
    }) as Record<string, unknown>;
    return ((data?.quotes as Record<string, unknown>[]) || [])
      .filter((r) => r.quoteType !== 'OPTION')
      .slice(0, 10)
      .map((r) => ({
        symbol: String(r.symbol),
        name: String(r.longname || r.shortname || r.symbol),
        type: String(r.quoteType || 'Equity'),
        displaySymbol: String(r.symbol),
      }));
  } catch {
    return searchMockStocks(query);
  }
}

function parseYahooChartResponse(data: unknown): ChartDataPoint[] {
  const d = data as Record<string, unknown>;
  const chart = d?.chart as Record<string, unknown> | undefined;
  const result = (chart?.result as Array<Record<string, unknown>> | undefined)?.[0];
  if (!result) return [];
  const ts = result.timestamp as number[] | undefined;
  if (!ts || ts.length === 0) return [];
  const indicators = result.indicators as Record<string, unknown> | undefined;
  const quoteArr = indicators?.quote as Array<Record<string, unknown>> | undefined;
  const q = quoteArr?.[0];
  if (!q) return [];
  return ts.map((t: number, i: number) => ({
    timestamp: t * 1000,
    open: Number((q.open as number[])?.[i] ?? 0),
    high: Number((q.high as number[])?.[i] ?? 0),
    low: Number((q.low as number[])?.[i] ?? 0),
    close: Number((q.close as number[])?.[i] ?? 0),
    volume: Number((q.volume as number[])?.[i] ?? 0),
  })).filter((p: ChartDataPoint) => p.close > 0);
}

async function yahooGetChartData(symbol: string, period: ChartPeriod): Promise<ChartDataPoint[]> {
  // Fetch real Yahoo Finance data — keep ALL data points for maximum chart detail.
  // Yahoo returns: 1D ~390pts, 1W ~390pts, 1M ~300pts, 1Y ~252pts, 5Y ~262pts
  const rangeMap: Record<ChartPeriod, { interval: string; range: string }> = {
    '1D': { interval: '5m',   range: '1d' },
    '1W': { interval: '15m',  range: '5d' },
    '1M': { interval: '1h',   range: '1mo' },
    '1Y': { interval: '1d',   range: '1y' },
    '5Y': { interval: '1wk',  range: '5y' },
  };
  const { interval, range } = rangeMap[period];

  // Try through yahooFetch (uses CORS proxy with fetch + axios fallback)
  try {
    const data = await yahooFetch(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      interval, range, includePrePost: false,
    });
    const points = parseYahooChartResponse(data);
    if (points.length > 0) return points;
  } catch { /* fall through */ }

  // Direct attempt via CORS proxy (tries both query1 and query2, fetch + axios)
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const data = await fetchWithCorsProxy(chartUrl);
    const points = parseYahooChartResponse(data);
    if (points.length > 0) return points;
  } catch { /* fall through */ }

  return [];
}

// In-memory cache (TTL: 30s for real-time quotes)
const quoteCache = new Map<string, { data: StockQuote; ts: number }>();
const QUOTE_TTL = 30_000;

// ─── Real-time Quote ──────────────────────────────────────────────────────────

export async function getQuote(symbol: string): Promise<StockQuote> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  // Try Yahoo Finance first (real data, no key needed — same as Apple Stocks app)
  const yahooQuote = await yahooGetQuote(symbol);
  if (yahooQuote && yahooQuote.price > 0) {
    quoteCache.set(symbol, { data: yahooQuote, ts: Date.now() });
    return yahooQuote;
  }

  // Try Finnhub if key is configured
  if (!IS_MOCK_STOCKS) {
    try {
      const res = await finnhub.get('/quote', { params: { symbol } });
      const d = res.data;
      if (d.c > 0) {
        const quote: StockQuote = {
          symbol, price: d.c, change: d.d, changePercent: d.dp, timestamp: Date.now(),
        };
        quoteCache.set(symbol, { data: quote, ts: Date.now() });
        return quote;
      }
    } catch { /* fall through */ }
  }

  // Fall back to mock data
  return cached?.data ?? getMockQuote(symbol);
}

export async function getQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {};

  // On web: v7/quote needs crumb which we skip, so fetch individually via v8/chart
  // On native: try batch v7/quote first
  if (Platform.OS !== 'web') {
    try {
      await ensureYahooSession();
      const allParams: Record<string, string | number | boolean> = { symbols: symbols.join(',') };
      if (_yahooCrumb) allParams['crumb'] = _yahooCrumb;
      const queryStr = '?' + Object.entries(allParams).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
      const fullUrl = `${YAHOO_BASE}/v7/finance/quote${queryStr}`;
      const res = await axios.get(fullUrl, {
        timeout: 12_000,
        headers: {
          'User-Agent': YAHOO_MOBILE_UA,
          'Accept': 'application/json',
          ..._yahooCookie ? { 'Cookie': _yahooCookie } : {},
        },
      });
      const quotes = ((res.data as Record<string, unknown>)?.quoteResponse as Record<string, unknown>)?.result as Record<string, unknown>[] | undefined;
      if (quotes && quotes.length > 0) {
        const out: Record<string, StockQuote> = {};
        for (const q of quotes) {
          const sym = String(q.symbol);
          const price = Number(q.regularMarketPrice ?? 0);
          const prevClose = Number(q.regularMarketPreviousClose ?? price);
          if (price > 0) {
            out[sym] = {
              symbol: sym, price,
              change: parseFloat((price - prevClose).toFixed(2)),
              changePercent: parseFloat(Number(q.regularMarketChangePercent ?? 0).toFixed(2)),
              timestamp: Date.now(),
            };
            quoteCache.set(sym, { data: out[sym], ts: Date.now() });
          }
        }
        for (const sym of symbols) {
          if (!out[sym]) out[sym] = await getQuote(sym);
        }
        return out;
      }
    } catch { /* fall through */ }
  }

  // Fallback: individual fetches
  const results = await Promise.allSettled(symbols.map(getQuote));
  return Object.fromEntries(
    results
      .map((r, i) => r.status === 'fulfilled' ? [symbols[i], r.value] : null)
      .filter(Boolean) as [string, StockQuote][]
  );
}

// ─── Full Stock Profile ───────────────────────────────────────────────────────

const profileCache = new Map<string, { data: Stock; ts: number }>();
const PROFILE_TTL = 60_000 * 5; // 5 min

export async function getStockProfile(symbol: string): Promise<Stock | null> {
  const cached = profileCache.get(symbol);
  if (cached && Date.now() - cached.ts < PROFILE_TTL) return cached.data;

  // Try Yahoo Finance first (real data — same source as Apple Stocks app)
  const yahooStock = await yahooGetProfile(symbol);
  if (yahooStock && yahooStock.price > 0) {
    profileCache.set(symbol, { data: yahooStock, ts: Date.now() });
    return yahooStock;
  }

  // Try Finnhub if key is configured
  if (!IS_MOCK_STOCKS) {
    try {
      const [profileRes, quoteRes, metricsRes] = await Promise.all([
        finnhub.get('/stock/profile2', { params: { symbol } }),
        finnhub.get('/quote', { params: { symbol } }),
        finnhub.get('/stock/metric', { params: { symbol, metric: 'all' } }),
      ]);
      const p = profileRes.data;
      const q = quoteRes.data;
      const m = metricsRes.data.metric || {};
      if (p.name || q.c > 0) {
        const stock: Stock = {
          symbol,
          name: p.name || symbol,
          exchange: p.exchange || '',
          country: p.country || '',
          currency: p.currency || 'USD',
          price: q.c,
          previousClose: q.pc,
          change: q.d,
          changePercent: q.dp,
          volume: q.v || 0,
          marketCap: p.marketCapitalization * 1e6 || 0,
          high52w: m['52WeekHigh'] || q.h,
          low52w: m['52WeekLow'] || q.l,
          pe: m.peBasicExclExtraTTM,
          eps: m.epsBasicExclExtraAnnual,
          dividend: m.dividendYieldIndicatedAnnual,
          sector: p.finnhubIndustry,
          logoUrl: p.logo,
          description: '',
          isOpen: isMarketOpen(p.exchange),
        };
        profileCache.set(symbol, { data: stock, ts: Date.now() });
        return stock;
      }
    } catch { /* fall through */ }
  }

  // Fall back to mock data
  return getMockStock(symbol);
}

// ─── Chart Data ───────────────────────────────────────────────────────────────

export async function getChartData(
  symbol: string,
  period: ChartPeriod,
  currentPrice?: number
): Promise<ChartDataPoint[]> {
  // Try Yahoo Finance first (real data — same as Apple Stocks app)
  try {
    const yahooData = await yahooGetChartData(symbol, period);
    if (yahooData.length > 0) {
      console.log(`[StockAPI] ${symbol} ${period}: Yahoo Finance OK, ${yahooData.length} points`);
      return yahooData;
    }
  } catch (e) {
    console.warn(`[StockAPI] ${symbol} ${period}: Yahoo Finance failed`, e);
  }

  // Try Finnhub as fallback if key is configured
  if (!IS_MOCK_STOCKS) {
    const { resolution, from } = periodToParams(period);
    const to = Math.floor(Date.now() / 1000);
    try {
      const res = await finnhub.get('/stock/candle', {
        params: { symbol, resolution, from, to },
      });
      const d = res.data;
      if (d.s === 'ok' && d.t) {
        return d.t.map((ts: number, i: number) => ({
          timestamp: ts * 1000,
          open: d.o[i],
          high: d.h[i],
          low: d.l[i],
          close: d.c[i],
          volume: d.v[i],
        }));
      }
    } catch { /* fall through */ }
  }

  // Generate realistic mock chart data based on actual price
  console.warn(`[StockAPI] ${symbol} ${period}: All APIs failed, using generated chart data`);
  return generateRealisticChart(symbol, period, currentPrice);
}

/**
 * Generates a realistic-looking price chart using geometric Brownian motion.
 * The chart ends at the stock's current price and works backwards with
 * realistic volatility scaled to the time period.
 */
function generateRealisticChart(symbol: string, period: ChartPeriod, priceHint?: number): ChartDataPoint[] {
  const entry = MOCK_DB[symbol.toUpperCase()];
  // Use: priceHint (live price from caller) → cached quote → mock DB → 100
  const cachedQuote = quoteCache.get(symbol);
  const currentPrice = priceHint
    ?? (cachedQuote?.data?.price && cachedQuote.data.price > 0 ? cachedQuote.data.price : null)
    ?? (entry ? mockSeededPrice(symbol.toUpperCase(), entry.price) : 100);
  const dailyVol = entry ? Math.abs(entry.changePercent) / 100 + 0.015 : 0.025; // daily volatility

  // Period config: { points, stepMs, volScale }
  // volScale controls how much price can move per step — higher = more realistic variation
  const config: Record<ChartPeriod, { points: number; stepMs: number; volScale: number }> = {
    '1D':  { points: 78,  stepMs: 5 * 60_000,       volScale: 0.35 },   // 5-min bars, ~6.5 hrs
    '1W':  { points: 130, stepMs: 15 * 60_000,      volScale: 0.6 },    // 15-min bars
    '1M':  { points: 150, stepMs: 60 * 60_000,      volScale: 1.2 },    // hourly bars
    '1Y':  { points: 252, stepMs: 24 * 3600_000,    volScale: 3.0 },    // daily bars
    '5Y':  { points: 260, stepMs: 7 * 24 * 3600_000, volScale: 6.0 },   // weekly bars
  };
  const { points, stepMs, volScale } = config[period];
  const vol = dailyVol * volScale;

  // Seeded pseudo-random for consistency
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let rngState = seed + period.charCodeAt(0) * 137;
  function seededRandom(): number {
    rngState = (rngState * 1664525 + 1013904223) & 0x7fffffff;
    return rngState / 0x7fffffff;
  }
  // Box-Muller for normal distribution
  function normalRandom(): number {
    const u1 = seededRandom() || 0.001;
    const u2 = seededRandom();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Work backwards from current price using geometric Brownian motion
  const now = Date.now();
  const prices: number[] = [currentPrice];
  for (let i = 1; i < points; i++) {
    const prev = prices[i - 1];
    // Reverse random walk: add noise going back in time
    const drift = -0.0002; // slight upward trend when going forward
    const shock = normalRandom() * vol;
    prices.push(prev * Math.exp(-(drift + shock)));
  }
  prices.reverse(); // Now goes from oldest to newest

  return prices.map((close, i) => {
    const timestamp = now - (points - 1 - i) * stepMs;
    const intraVol = close * vol * 0.3;
    const open = close + (seededRandom() - 0.5) * intraVol;
    const high = Math.max(open, close) + seededRandom() * intraVol * 0.5;
    const low = Math.min(open, close) - seededRandom() * intraVol * 0.5;
    const volume = Math.floor(5_000_000 + seededRandom() * 30_000_000);
    return {
      timestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    };
  });
}

function periodToParams(period: ChartPeriod): { resolution: string; from: number } {
  const now = Math.floor(Date.now() / 1000);
  switch (period) {
    case '1D':  return { resolution: '5',  from: now - 86400 };
    case '1W':  return { resolution: '15', from: now - 86400 * 7 };
    case '1M':  return { resolution: '60', from: now - 86400 * 30 };
    case '1Y':  return { resolution: 'W',  from: now - 86400 * 365 };
    case '5Y':  return { resolution: 'M',  from: now - 86400 * 365 * 5 };
  }
}

// ─── Stock Search ─────────────────────────────────────────────────────────────

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  displaySymbol: string;
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  // When Finnhub key is configured, use Finnhub symbol search for broadest global coverage
  if (!IS_MOCK_STOCKS) {
    try {
      const res = await axios.get(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`,
        { timeout: 10_000 }
      );
      const results: SearchResult[] = (res.data.result || []).slice(0, 20).map((r: Record<string, string>) => ({
        symbol: r.symbol,
        name: r.description,
        type: r.type,
        displaySymbol: r.displaySymbol,
      }));
      if (results.length > 0) return results;
    } catch { /* fall through to Yahoo */ }
  }

  // Yahoo Finance search — same as Apple Stocks app, no API key needed
  const yahooResults = await yahooSearch(query);
  if (yahooResults.length > 0) return yahooResults;

  // Fall back to mock database
  return searchMockStocks(query);
}

// ─── Trending / Movers ────────────────────────────────────────────────────────

function buildMoversFromQuotes(quotes: Record<string, StockQuote>) {
  const sorted = Object.values(quotes).sort((a, b) => b.changePercent - a.changePercent);
  return {
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
    active: [...Object.values(quotes)].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 5),
  };
}

export async function getMarketMovers(): Promise<{
  gainers: StockQuote[];
  losers: StockQuote[];
  active: StockQuote[];
}> {
  const { POPULAR_STOCKS } = await import('../constants/stocks');
  const symbols = POPULAR_STOCKS.slice(0, 20).map(s => s.symbol);

  // Race real data against a timeout — fall back to mock data if too slow
  const realDataPromise = getQuotes(symbols).then(buildMoversFromQuotes);
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000));

  const result = await Promise.race([realDataPromise, timeoutPromise]);
  if (result) return result;

  // Timeout: use mock quotes so the UI isn't stuck loading
  const mockQuotes: Record<string, StockQuote> = {};
  for (const sym of symbols) mockQuotes[sym] = getMockQuote(sym);
  return buildMoversFromQuotes(mockQuotes);
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function getCompanyNews(
  symbol: string,
  from?: string,
  to?: string
): Promise<NewsArticle[]> {
  if (IS_MOCK_STOCKS) return getMockNews(symbol);

  const today = to ?? new Date().toISOString().split('T')[0];
  const weekAgo = from ?? new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0];

  try {
    const res = await finnhub.get('/company-news', {
      params: { symbol, from: weekAgo, to: today },
    });
    const articles = (res.data || []).slice(0, 10).map((n: Record<string, unknown>) => ({
      id: String(n.id),
      headline: n.headline as string,
      summary: n.summary as string,
      source: n.source as string,
      url: n.url as string,
      imageUrl: n.image as string | undefined,
      publishedAt: (n.datetime as number) * 1000,
      relatedSymbols: [symbol],
    }));
    if (articles.length === 0) return getMockNews(symbol);
    return articles;
  } catch {
    return getMockNews(symbol);
  }
}

export async function getMarketNews(): Promise<NewsArticle[]> {
  try {
    const res = await finnhub.get('/news', { params: { category: 'general' } });
    return (res.data || []).slice(0, 20).map((n: Record<string, unknown>) => ({
      id: String(n.id),
      headline: n.headline as string,
      summary: n.summary as string,
      source: n.source as string,
      url: n.url as string,
      imageUrl: n.image as string | undefined,
      publishedAt: (n.datetime as number) * 1000,
      relatedSymbols: [],
    }));
  } catch {
    return [];
  }
}

// ─── WebSocket for Real-Time Prices ──────────────────────────────────────────

let ws: WebSocket | null = null;
const wsCallbacks = new Map<string, ((quote: StockQuote) => void)[]>();

export function subscribeToPrices(
  symbols: string[],
  onUpdate: (symbol: string, quote: StockQuote) => void
) {
  function safeSend(msg: string) {
    try {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
    } catch { /* ignore send errors */ }
  }

  if (!ws || ws.readyState > 1) {
    ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`);

    ws.addEventListener('open', () => {
      symbols.forEach(s => safeSend(JSON.stringify({ type: 'subscribe', symbol: s })));
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade' && msg.data) {
          msg.data.forEach((trade: { s: string; p: number; t: number }) => {
            const quote: StockQuote = {
              symbol: trade.s,
              price: trade.p,
              change: 0,
              changePercent: 0,
              timestamp: trade.t,
            };
            quoteCache.set(trade.s, { data: quote, ts: Date.now() });
            onUpdate(trade.s, quote);
          });
        }
      } catch { /* ignore parse errors */ }
    });

    ws.addEventListener('close', () => {
      ws = null;
    });
  } else {
    symbols.forEach(s => safeSend(JSON.stringify({ type: 'subscribe', symbol: s })));
  }

  return () => {
    symbols.forEach(s => safeSend(JSON.stringify({ type: 'unsubscribe', symbol: s })));
  };
}

// ─── Market Hours ─────────────────────────────────────────────────────────────

export function isMarketOpen(exchange: string): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false; // weekend

  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcTime = utcHour * 60 + utcMin;

  // NYSE/NASDAQ: 9:30am–4:00pm ET = 14:30–21:00 UTC
  if (['NYSE', 'NASDAQ', 'US'].includes(exchange)) {
    return utcTime >= 870 && utcTime < 1260;
  }
  // London: 8:00am–4:30pm BST (UTC+1 summer) ≈ 7:00–15:30 UTC
  if (['LSE', 'GB'].includes(exchange)) {
    return utcTime >= 420 && utcTime < 930;
  }
  // Default: assume open on weekdays
  return true;
}

export function getMarketStatus(exchange: string): string {
  return isMarketOpen(exchange) ? 'Open' : 'Closed';
}
