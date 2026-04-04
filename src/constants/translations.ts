/**
 * Lightweight i18n system for StockQuest.
 * Usage:  import { useT } from '../constants/translations';
 *         const t = useT();  // inside component
 *         <Text>{t('home')}</Text>
 */
import { useAppStore } from '../store/useAppStore';

// ─── Language list (100+ languages) ─────────────────────────────────────────

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  // Major world languages
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Кыргызча' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmençe' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာ' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ti', name: 'Tigrinya', nativeName: 'ትግርኛ' },
  { code: 'om', name: 'Oromo', nativeName: 'Afaan Oromoo' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho' },
  { code: 'rw', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda' },
  { code: 'sn', name: 'Shona', nativeName: 'chiShona' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy' },
  { code: 'wo', name: 'Wolof', nativeName: 'Wolof' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'gd', name: 'Scottish Gaelic', nativeName: 'Gàidhlig' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch' },
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto' },
  { code: 'la', name: 'Latin', nativeName: 'Latina' },
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori' },
  { code: 'sm', name: 'Samoan', nativeName: 'Gagana Samoa' },
  { code: 'to', name: 'Tongan', nativeName: 'Lea Faka-Tonga' },
  { code: 'fj', name: 'Fijian', nativeName: 'Vosa Vakaviti' },
  { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi' },
  { code: 'jv', name: 'Javanese', nativeName: 'Basa Jawa' },
  { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda' },
  { code: 'ceb', name: 'Cebuano', nativeName: 'Cebuano' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen' },
  { code: 'ku', name: 'Kurdish', nativeName: 'Kurdî' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي' },
  { code: 'ug', name: 'Uyghur', nativeName: 'ئۇيغۇرچە' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская' },
  { code: 'tt', name: 'Tatar', nativeName: 'Татарча' },
];

// ─── Translation dictionaries ────────────────────────────────────────────────

type Dict = Record<string, string>;

const en: Dict = {
  home: 'Home', markets: 'Markets', portfolio: 'Portfolio', social: 'Social',
  profile: 'Profile', leaderboard: 'Leaderboard', trade: 'Trade',
  market_movers: 'Market Movers', top_gainers: 'Top Gainers', top_losers: 'Top Losers',
  most_changed: 'Most Changed', watchlist: 'Watchlist', market_news: 'Market News',
  search_stocks: 'Search stocks, ETFs — e.g. AAPL, Tesla...',
  no_results: 'No results found', loading: 'Loading...', loading_market: 'Loading market data...',
  manage: 'Manage', done: 'Done', see_all: 'See All', tap_to_trade: 'Tap to trade',
  no_watchlist: 'No stocks in your watchlist.', search_to_add: 'Search for stocks to add them here.',
  total_portfolio_value: 'Total Portfolio Value', performance_30d: 'Performance (30 Days)',
  holdings: 'Holdings', performance_stats: 'Performance Stats', recent_activity: 'Recent Activity',
  no_holdings: 'No holdings yet', buy_first_stock: 'Buy your first stock to get started.',
  start_trading: 'Start Trading', no_transactions: 'No transactions yet.',
  cash_balance: 'Cash Balance', invested: 'Invested', starting: 'Starting',
  best_trade: 'Best Trade', worst_trade: 'Worst Trade', total_trades: 'Total Trades',
  portfolio_age: 'Portfolio Age', shares: 'shares', bought: 'Bought', sold: 'Sold',
  days_active: 'days active',
  buy: 'Buy', sell: 'Sell', place_order: 'Place Order', confirm_order: 'Confirm Order',
  market_buy: 'Market BUY', market_sell: 'Market SELL', symbol: 'Symbol',
  order_type: 'Order Type', market_order: 'Market Order', quantity: 'Quantity',
  est_price: 'Est. Price', est_total: 'Est. Total', cancel: 'Cancel',
  confirm_buy: 'Confirm Buy', confirm_sell: 'Confirm Sell',
  available_cash: 'Available cash', shares_owned: 'Shares owned',
  dollars: '$ Dollars', num_shares: '# Shares', watch: 'Watch', watching: 'Watching',
  find_stock: 'Find a Stock', search_stock_desc: 'Search for any stock, ETF, or index to view details and place orders',
  recent_news: 'Recent News', no_recent_news: 'No recent news',
  key_stats: 'Key Stats', market_cap: 'Market Cap', pe_ratio: 'P/E Ratio',
  volume: 'Volume', w52_high: '52W High', w52_low: '52W Low', dividend: 'Dividend',
  open: 'Open', closed: 'Closed',
  global: 'Global', local: 'Local', club: 'Club', friends: 'Friends',
  global_rankings: 'Global Rankings', loading_rankings: 'Loading rankings...',
  no_rankings: 'No Rankings Yet', rankings_will_appear: 'Rankings will appear here once players start trading.',
  refresh: 'Refresh', your_position: 'Your Position', your_performance: 'Your Performance',
  current_rank: 'Current Rank', starting_balance: 'Starting Balance',
  current_value: 'Current Value', total_gain: 'Total Gain',
  achievements: 'Achievements', this_month: 'This Month', last_6_months: 'Last 6 Months', this_year: 'This Year',
  messages: 'Messages', clubs: 'Clubs', rankings: 'Rankings',
  invites: 'Invites', no_invites: 'No pending invites', no_pending_invites: 'No pending invites',
  no_conversations: 'No conversations yet', no_conversations_yet: 'No conversations yet',
  no_messages_yet: 'No messages yet. Say hi!',
  find_friends_desc: 'Find friends or join clubs to start chatting',
  type_message: 'Type a message...', type_a_message: 'Type a message...',
  send: 'Send', message: 'Message', add_friend: '+ Add Friend',
  search_placeholder: 'Search username or account #',
  no_users_found: 'No users found.', results: 'Results',
  trade_proposals: 'Pending Trade Proposals', accept: 'Accept', decline: 'Decline',
  trade_proposal: 'Trade Proposal',
  my_clubs: 'My Clubs', discover: 'Discover', create_club: 'Create Club',
  club_name: 'Club Name', description: 'Description', public: 'Public',
  join: 'Join', create: 'Create', edit: 'Edit', invite: 'Invite',
  leave_club: 'Leave Club', invite_sent: 'Invite sent!',
  player_not_found: 'Player not found', members: 'members',
  player_number: 'Player Number', enter_player_number: 'Enter 8-digit account number',
  settings: 'Settings', account_number: 'Account Number', appearance: 'Appearance',
  mode: 'Mode', dark: 'Dark', light: 'Light', accent_colour: 'Accent Colour',
  language: 'Language', select_language: 'Select Language', search_languages: 'Search languages...',
  reset_defaults: 'Reset to Defaults', sign_out: 'Sign Out',
  delete_account: 'Delete Account', sign_out_confirm: 'Are you sure you want to sign out?',
  delete_confirm: 'This will permanently delete your account, portfolio, and all progress. This cannot be undone.',
  xp_levels: 'XP Levels', portfolio_value: 'Portfolio Value',
  orders_placed: 'orders placed', avg: 'Avg',
  tile_style: 'Tile Style', screen_colours: 'Screen Colours',
  learn: 'Learn', trophy: 'Trophy', no_data: 'No data available',
  not_signed_in: 'Not signed in', please_login: 'Please log in to trade.',
  enter_amount: 'Enter an amount', insufficient_funds: 'Insufficient funds',
  not_enough_shares: 'Not enough shares', about_company: 'About',
  wardrobe: 'Wardrobe', choose_animal: 'Choose Animal', background_colour: 'Background Colour',
  preview: 'Preview',
  confirm: 'Confirm', save: 'Save', delete: 'Delete', error: 'Error',
  success: 'Success', back: 'Back', close: 'Close', about: 'About', you: 'YOU',
};

// ─── Full dictionaries for major languages ───────────────────────────────────

const es: Dict = {
  home: 'Inicio', markets: 'Mercados', portfolio: 'Portafolio', social: 'Social',
  profile: 'Perfil', leaderboard: 'Clasificación', trade: 'Operar',
  market_movers: 'Movimientos', top_gainers: 'Mayores Alzas', top_losers: 'Mayores Bajas',
  most_changed: 'Más Cambiados', watchlist: 'Favoritos', market_news: 'Noticias',
  search_stocks: 'Buscar acciones, ETFs — ej. AAPL, Tesla...',
  no_results: 'Sin resultados', loading: 'Cargando...', loading_market: 'Cargando datos...',
  manage: 'Gestionar', done: 'Listo', see_all: 'Ver Todo', tap_to_trade: 'Toca para operar',
  no_watchlist: 'Sin acciones en favoritos.', search_to_add: 'Busca acciones para agregarlas.',
  total_portfolio_value: 'Valor Total del Portafolio', performance_30d: 'Rendimiento (30 Días)',
  holdings: 'Posiciones', performance_stats: 'Estadísticas', recent_activity: 'Actividad Reciente',
  no_holdings: 'Sin posiciones aún', buy_first_stock: 'Compra tu primera acción para empezar.',
  start_trading: 'Empezar a Operar', no_transactions: 'Sin transacciones aún.',
  cash_balance: 'Efectivo', invested: 'Invertido', starting: 'Inicial',
  best_trade: 'Mejor Operación', worst_trade: 'Peor Operación', total_trades: 'Total Operaciones',
  portfolio_age: 'Antigüedad', shares: 'acciones', bought: 'Comprado', sold: 'Vendido',
  days_active: 'días activo', orders_placed: 'órdenes realizadas', avg: 'Prom',
  buy: 'Comprar', sell: 'Vender', place_order: 'Crear Orden', confirm_order: 'Confirmar Orden',
  market_buy: 'COMPRA', market_sell: 'VENTA', symbol: 'Símbolo',
  order_type: 'Tipo de Orden', market_order: 'Orden de Mercado', quantity: 'Cantidad',
  est_price: 'Precio Est.', est_total: 'Total Est.', cancel: 'Cancelar',
  confirm_buy: 'Confirmar Compra', confirm_sell: 'Confirmar Venta',
  available_cash: 'Efectivo disponible', shares_owned: 'Acciones propias',
  dollars: '$ Dólares', num_shares: '# Acciones', watch: 'Seguir', watching: 'Siguiendo',
  find_stock: 'Buscar Acción', search_stock_desc: 'Busca cualquier acción, ETF o índice',
  recent_news: 'Noticias Recientes', no_recent_news: 'Sin noticias recientes',
  key_stats: 'Estadísticas', market_cap: 'Cap. Mercado', pe_ratio: 'P/E',
  volume: 'Volumen', w52_high: 'Máx 52S', w52_low: 'Mín 52S', dividend: 'Dividendo',
  open: 'Abierto', closed: 'Cerrado',
  global: 'Global', local: 'Local', club: 'Club', friends: 'Amigos',
  global_rankings: 'Clasificación Global', loading_rankings: 'Cargando clasificación...',
  no_rankings: 'Sin Clasificación', rankings_will_appear: 'La clasificación aparecerá cuando los jugadores empiecen a operar.',
  refresh: 'Actualizar', your_position: 'Tu Posición', your_performance: 'Tu Rendimiento',
  current_rank: 'Puesto Actual', starting_balance: 'Balance Inicial',
  current_value: 'Valor Actual', total_gain: 'Ganancia Total',
  achievements: 'Logros', this_month: 'Este Mes', last_6_months: 'Últimos 6 Meses', this_year: 'Este Año',
  messages: 'Mensajes', clubs: 'Clubes', rankings: 'Clasificación',
  invites: 'Invitaciones', no_invites: 'Sin invitaciones pendientes', no_pending_invites: 'Sin invitaciones pendientes',
  no_conversations: 'Sin conversaciones aún', no_conversations_yet: 'Sin conversaciones aún',
  no_messages_yet: 'Sin mensajes aún. ¡Saluda!',
  find_friends_desc: 'Busca amigos o únete a clubes',
  type_message: 'Escribe un mensaje...', type_a_message: 'Escribe un mensaje...',
  send: 'Enviar', message: 'Mensaje', add_friend: '+ Amigo',
  search_placeholder: 'Buscar usuario o cuenta #',
  no_users_found: 'Usuarios no encontrados.', results: 'Resultados',
  trade_proposals: 'Propuestas Pendientes', accept: 'Aceptar', decline: 'Rechazar',
  trade_proposal: 'Propuesta de Intercambio',
  my_clubs: 'Mis Clubes', discover: 'Descubrir', create_club: 'Crear Club',
  club_name: 'Nombre del Club', description: 'Descripción', public: 'Público',
  join: 'Unirse', create: 'Crear', edit: 'Editar', invite: 'Invitar',
  leave_club: 'Salir del Club', invite_sent: '¡Invitación enviada!',
  player_not_found: 'Jugador no encontrado', members: 'miembros',
  player_number: 'Número de Jugador', enter_player_number: 'Ingresa número de cuenta de 8 dígitos',
  settings: 'Ajustes', account_number: 'Número de Cuenta', appearance: 'Apariencia',
  mode: 'Modo', dark: 'Oscuro', light: 'Claro', accent_colour: 'Color de Acento',
  language: 'Idioma', select_language: 'Seleccionar Idioma', search_languages: 'Buscar idiomas...',
  reset_defaults: 'Restaurar Valores', sign_out: 'Cerrar Sesión',
  delete_account: 'Eliminar Cuenta', sign_out_confirm: '¿Seguro que quieres cerrar sesión?',
  delete_confirm: 'Esto eliminará permanentemente tu cuenta, portafolio y todo tu progreso.',
  xp_levels: 'Niveles XP', portfolio_value: 'Valor del Portafolio',
  tile_style: 'Estilo de Tarjeta', screen_colours: 'Colores de Pantalla',
  learn: 'Aprender', trophy: 'Trofeo', no_data: 'Sin datos disponibles',
  not_signed_in: 'No has iniciado sesión', please_login: 'Inicia sesión para operar.',
  enter_amount: 'Ingresa una cantidad', insufficient_funds: 'Fondos insuficientes',
  not_enough_shares: 'Acciones insuficientes', about_company: 'Acerca de',
  wardrobe: 'Vestuario', choose_animal: 'Elegir Animal', background_colour: 'Color de Fondo',
  preview: 'Vista Previa',
  confirm: 'Confirmar', save: 'Guardar', delete: 'Eliminar', error: 'Error',
  success: 'Éxito', back: 'Atrás', close: 'Cerrar', about: 'Acerca de', you: 'TÚ',
};

const fr: Dict = {
  home: 'Accueil', markets: 'Marchés', portfolio: 'Portefeuille', social: 'Social',
  profile: 'Profil', leaderboard: 'Classement', trade: 'Trader',
  market_movers: 'Mouvements', top_gainers: 'Meilleures Hausses', top_losers: 'Meilleures Baisses',
  most_changed: 'Plus Changés', watchlist: 'Favoris', market_news: 'Actualités',
  search_stocks: 'Chercher actions, ETF — ex. AAPL, Tesla...',
  no_results: 'Aucun résultat', loading: 'Chargement...', loading_market: 'Chargement des données...',
  manage: 'Gérer', done: 'Terminé', see_all: 'Voir Tout', tap_to_trade: 'Appuyer pour trader',
  no_watchlist: 'Aucune action en favoris.', search_to_add: 'Cherchez des actions à ajouter.',
  total_portfolio_value: 'Valeur Totale', performance_30d: 'Performance (30 Jours)',
  holdings: 'Positions', performance_stats: 'Statistiques', recent_activity: 'Activité Récente',
  no_holdings: 'Aucune position', buy_first_stock: 'Achetez votre première action.',
  start_trading: 'Commencer', no_transactions: 'Aucune transaction.',
  cash_balance: 'Solde', invested: 'Investi', starting: 'Initial',
  best_trade: 'Meilleur Trade', worst_trade: 'Pire Trade', total_trades: 'Total Trades',
  portfolio_age: 'Ancienneté', shares: 'actions', bought: 'Acheté', sold: 'Vendu',
  days_active: 'jours actifs', orders_placed: 'ordres passés', avg: 'Moy',
  buy: 'Acheter', sell: 'Vendre', place_order: 'Passer Ordre', confirm_order: 'Confirmer Ordre',
  market_buy: 'ACHAT', market_sell: 'VENTE', symbol: 'Symbole',
  order_type: "Type d'Ordre", market_order: 'Ordre au Marché', quantity: 'Quantité',
  est_price: 'Prix Est.', est_total: 'Total Est.', cancel: 'Annuler',
  confirm_buy: "Confirmer l'Achat", confirm_sell: 'Confirmer la Vente',
  available_cash: 'Fonds disponibles', shares_owned: 'Actions détenues',
  dollars: '$ Dollars', num_shares: '# Actions', watch: 'Suivre', watching: 'Suivi',
  find_stock: 'Trouver une Action', search_stock_desc: 'Cherchez une action, ETF ou indice',
  recent_news: 'Actualités Récentes', no_recent_news: 'Pas de nouvelles',
  key_stats: 'Statistiques', market_cap: 'Cap. Boursière', pe_ratio: 'P/E',
  volume: 'Volume', w52_high: 'Max 52S', w52_low: 'Min 52S', dividend: 'Dividende',
  open: 'Ouvert', closed: 'Fermé',
  global: 'Mondial', local: 'Local', club: 'Club', friends: 'Amis',
  global_rankings: 'Classement Mondial', loading_rankings: 'Chargement du classement...',
  no_rankings: 'Pas de Classement', rankings_will_appear: 'Le classement apparaîtra quand les joueurs commenceront à trader.',
  refresh: 'Actualiser', your_position: 'Votre Position', your_performance: 'Votre Performance',
  current_rank: 'Classement', starting_balance: 'Solde Initial',
  current_value: 'Valeur Actuelle', total_gain: 'Gain Total',
  achievements: 'Succès', this_month: 'Ce Mois', last_6_months: '6 Derniers Mois', this_year: 'Cette Année',
  messages: 'Messages', clubs: 'Clubs', rankings: 'Classement',
  invites: 'Invitations', no_invites: "Pas d'invitations", no_pending_invites: "Pas d'invitations",
  no_conversations: 'Aucune conversation', no_conversations_yet: 'Aucune conversation',
  no_messages_yet: 'Aucun message. Dites bonjour !',
  find_friends_desc: 'Trouvez des amis ou rejoignez des clubs',
  type_message: 'Écrire un message...', type_a_message: 'Écrire un message...',
  send: 'Envoyer', message: 'Message', add_friend: '+ Ami',
  search_placeholder: 'Chercher utilisateur ou compte #',
  no_users_found: 'Aucun utilisateur trouvé.', results: 'Résultats',
  trade_proposals: 'Propositions en Attente', accept: 'Accepter', decline: 'Refuser',
  trade_proposal: 'Proposition de Trade',
  my_clubs: 'Mes Clubs', discover: 'Découvrir', create_club: 'Créer un Club',
  club_name: 'Nom du Club', description: 'Description', public: 'Public',
  join: 'Rejoindre', create: 'Créer', edit: 'Modifier', invite: 'Inviter',
  leave_club: 'Quitter le Club', invite_sent: 'Invitation envoyée !',
  player_not_found: 'Joueur introuvable', members: 'membres',
  player_number: 'Numéro de Joueur', enter_player_number: 'Entrez le numéro de compte à 8 chiffres',
  settings: 'Paramètres', account_number: 'Numéro de Compte', appearance: 'Apparence',
  mode: 'Mode', dark: 'Sombre', light: 'Clair', accent_colour: "Couleur d'Accent",
  language: 'Langue', select_language: 'Choisir la Langue', search_languages: 'Chercher langues...',
  reset_defaults: 'Réinitialiser', sign_out: 'Déconnexion',
  delete_account: 'Supprimer le Compte', sign_out_confirm: 'Voulez-vous vraiment vous déconnecter ?',
  delete_confirm: 'Cela supprimera définitivement votre compte, portefeuille et toute progression.',
  xp_levels: 'Niveaux XP', portfolio_value: 'Valeur du Portefeuille',
  tile_style: 'Style de Carte', screen_colours: "Couleurs d'Écran",
  learn: 'Apprendre', trophy: 'Trophée', no_data: 'Aucune donnée',
  not_signed_in: 'Non connecté', please_login: 'Connectez-vous pour trader.',
  enter_amount: 'Entrez un montant', insufficient_funds: 'Fonds insuffisants',
  not_enough_shares: 'Actions insuffisantes', about_company: 'À propos de',
  wardrobe: 'Garde-Robe', choose_animal: 'Choisir Animal', background_colour: 'Couleur de Fond',
  preview: 'Aperçu',
  confirm: 'Confirmer', save: 'Enregistrer', delete: 'Supprimer', error: 'Erreur',
  success: 'Succès', back: 'Retour', close: 'Fermer', about: 'À propos', you: 'VOUS',
};

const de: Dict = {
  home: 'Start', markets: 'Märkte', portfolio: 'Portfolio', social: 'Sozial',
  profile: 'Profil', leaderboard: 'Rangliste', trade: 'Handeln',
  market_movers: 'Marktbeweger', top_gainers: 'Top Gewinner', top_losers: 'Top Verlierer',
  most_changed: 'Meiste Änderung', watchlist: 'Merkliste', market_news: 'Nachrichten',
  search_stocks: 'Aktien, ETFs suchen — z.B. AAPL, Tesla...',
  no_results: 'Keine Ergebnisse', loading: 'Laden...', loading_market: 'Marktdaten laden...',
  manage: 'Verwalten', done: 'Fertig', see_all: 'Alle ansehen', tap_to_trade: 'Zum Handeln tippen',
  buy: 'Kaufen', sell: 'Verkaufen', place_order: 'Order aufgeben', confirm_order: 'Order bestätigen',
  cancel: 'Abbrechen', confirm_buy: 'Kauf bestätigen', confirm_sell: 'Verkauf bestätigen',
  holdings: 'Bestände', cash_balance: 'Bargeld', invested: 'Investiert', starting: 'Anfang',
  best_trade: 'Bester Trade', worst_trade: 'Schlechtester Trade', total_trades: 'Gesamt Trades',
  shares: 'Aktien', bought: 'Gekauft', sold: 'Verkauft', days_active: 'Tage aktiv',
  orders_placed: 'Orders aufgegeben', avg: 'Durchschn.',
  global: 'Global', local: 'Lokal', club: 'Club', friends: 'Freunde',
  messages: 'Nachrichten', clubs: 'Clubs', rankings: 'Rangliste',
  settings: 'Einstellungen', appearance: 'Erscheinung', mode: 'Modus',
  dark: 'Dunkel', light: 'Hell', accent_colour: 'Akzentfarbe',
  language: 'Sprache', select_language: 'Sprache wählen', search_languages: 'Sprachen suchen...',
  reset_defaults: 'Zurücksetzen', sign_out: 'Abmelden',
  learn: 'Lernen', trophy: 'Trophäe', achievements: 'Erfolge',
  wardrobe: 'Garderobe', choose_animal: 'Tier wählen', background_colour: 'Hintergrundfarbe',
  preview: 'Vorschau', save: 'Speichern', confirm: 'Bestätigen',
  accept: 'Annehmen', decline: 'Ablehnen', send: 'Senden', message: 'Nachricht',
  add_friend: '+ Freund', refresh: 'Aktualisieren', you: 'DU',
  volume: 'Volumen', dividend: 'Dividende', open: 'Offen', closed: 'Geschlossen',
  watch: 'Merken', watching: 'Gemerkt', find_stock: 'Aktie finden',
  recent_news: 'Aktuelle Nachrichten', no_recent_news: 'Keine Nachrichten',
  no_data: 'Keine Daten verfügbar', loading_rankings: 'Rangliste laden...',
  portfolio_value: 'Portfoliowert', total_gain: 'Gesamtgewinn',
  starting_balance: 'Startguthaben', current_value: 'Aktueller Wert',
  delete_account: 'Konto löschen', close: 'Schließen', back: 'Zurück',
  invite: 'Einladen', join: 'Beitreten', create: 'Erstellen', edit: 'Bearbeiten',
  results: 'Ergebnisse', no_users_found: 'Keine Benutzer gefunden.',
};

const pt: Dict = {
  home: 'Início', markets: 'Mercados', portfolio: 'Portfólio', social: 'Social',
  profile: 'Perfil', leaderboard: 'Classificação', trade: 'Negociar',
  buy: 'Comprar', sell: 'Vender', cancel: 'Cancelar', confirm: 'Confirmar',
  loading: 'Carregando...', no_results: 'Sem resultados', settings: 'Configurações',
  language: 'Idioma', select_language: 'Selecionar Idioma', search_languages: 'Buscar idiomas...',
  sign_out: 'Sair', you: 'VOCÊ', global: 'Global', local: 'Local', friends: 'Amigos',
  messages: 'Mensagens', clubs: 'Clubes', rankings: 'Classificação',
  add_friend: '+ Amigo', holdings: 'Posições', achievements: 'Conquistas',
  appearance: 'Aparência', dark: 'Escuro', light: 'Claro', mode: 'Modo',
  save: 'Salvar', send: 'Enviar', accept: 'Aceitar', decline: 'Recusar',
  watchlist: 'Favoritos', market_news: 'Notícias', refresh: 'Atualizar',
  wardrobe: 'Guarda-Roupa', preview: 'Pré-visualização',
  cash_balance: 'Saldo', invested: 'Investido', bought: 'Comprado', sold: 'Vendido',
  shares: 'ações', volume: 'Volume', open: 'Aberto', closed: 'Fechado',
  watch: 'Seguir', watching: 'Seguindo', recent_news: 'Notícias Recentes',
  learn: 'Aprender', trophy: 'Troféu',
};

const zh: Dict = {
  home: '首页', markets: '市场', portfolio: '投资组合', social: '社交',
  profile: '个人资料', leaderboard: '排行榜', trade: '交易',
  market_movers: '市场动态', top_gainers: '涨幅最大', top_losers: '跌幅最大',
  most_changed: '变化最大', watchlist: '自选股', market_news: '市场新闻',
  buy: '买入', sell: '卖出', cancel: '取消', confirm: '确认',
  loading: '加载中...', no_results: '没有结果', settings: '设置',
  language: '语言', select_language: '选择语言', search_languages: '搜索语言...',
  sign_out: '退出登录', you: '你', global: '全球', local: '本地',
  friends: '好友', messages: '消息', clubs: '俱乐部', rankings: '排名',
  add_friend: '+ 好友', holdings: '持仓', achievements: '成就',
  appearance: '外观', dark: '深色', light: '浅色', mode: '模式',
  save: '保存', send: '发送', accept: '接受', decline: '拒绝',
  watchlist: '自选股', refresh: '刷新', wardrobe: '衣柜', preview: '预览',
  cash_balance: '现金余额', invested: '已投资', bought: '买入', sold: '卖出',
  shares: '股', volume: '成交量', open: '开盘', closed: '收盘',
  watch: '关注', watching: '已关注', recent_news: '最新资讯',
  portfolio_value: '投资组合价值', total_gain: '总收益',
  starting_balance: '初始余额', current_value: '当前价值',
  place_order: '下单', confirm_order: '确认订单',
  find_stock: '查找股票', market_order: '市价单',
  learn: '学习', trophy: '奖杯', back: '返回', close: '关闭',
};

const ja: Dict = {
  home: 'ホーム', markets: 'マーケット', portfolio: 'ポートフォリオ', social: 'ソーシャル',
  profile: 'プロフィール', leaderboard: 'ランキング', trade: '取引',
  market_movers: '市場動向', top_gainers: '値上がり', top_losers: '値下がり',
  buy: '購入', sell: '売却', cancel: 'キャンセル', confirm: '確認',
  loading: '読み込み中...', no_results: '結果なし', settings: '設定',
  language: '言語', select_language: '言語を選択', search_languages: '言語を検索...',
  sign_out: 'ログアウト', you: 'あなた', global: 'グローバル', local: 'ローカル',
  friends: 'フレンド', messages: 'メッセージ', clubs: 'クラブ', rankings: 'ランキング',
  add_friend: '+ フレンド', holdings: '保有', achievements: '実績',
  appearance: '外観', dark: 'ダーク', light: 'ライト', mode: 'モード',
  save: '保存', send: '送信', accept: '承認', decline: '拒否',
  watchlist: 'ウォッチリスト', refresh: '更新', wardrobe: 'ワードローブ', preview: 'プレビュー',
  cash_balance: '現金残高', shares: '株', volume: '出来高',
  watch: 'ウォッチ', watching: 'ウォッチ中', recent_news: '最新ニュース',
  learn: '学ぶ', trophy: 'トロフィー', back: '戻る', close: '閉じる',
  portfolio_value: 'ポートフォリオ価値', total_gain: '総利益',
  place_order: '注文', find_stock: '銘柄検索',
};

const ko: Dict = {
  home: '홈', markets: '시장', portfolio: '포트폴리오', social: '소셜',
  profile: '프로필', leaderboard: '순위표', trade: '거래',
  buy: '매수', sell: '매도', cancel: '취소', confirm: '확인',
  loading: '로딩 중...', no_results: '결과 없음', settings: '설정',
  language: '언어', select_language: '언어 선택', search_languages: '언어 검색...',
  sign_out: '로그아웃', you: '나', global: '글로벌', local: '로컬',
  friends: '친구', messages: '메시지', clubs: '클럽', rankings: '순위',
  add_friend: '+ 친구', holdings: '보유', achievements: '업적',
  dark: '다크', light: '라이트', mode: '모드',
  save: '저장', send: '보내기', accept: '수락', decline: '거절',
  watchlist: '관심목록', refresh: '새로고침', wardrobe: '옷장', preview: '미리보기',
  learn: '배우기', trophy: '트로피', back: '뒤로', close: '닫기',
};

const ar: Dict = {
  home: 'الرئيسية', markets: 'الأسواق', portfolio: 'المحفظة', social: 'اجتماعي',
  profile: 'الملف', leaderboard: 'الترتيب', trade: 'تداول',
  buy: 'شراء', sell: 'بيع', cancel: 'إلغاء', confirm: 'تأكيد',
  loading: 'جاري التحميل...', settings: 'الإعدادات',
  language: 'اللغة', select_language: 'اختر اللغة', search_languages: 'البحث عن لغة...',
  sign_out: 'تسجيل الخروج', you: 'أنت', global: 'عالمي', local: 'محلي',
  friends: 'أصدقاء', messages: 'رسائل', dark: 'داكن', light: 'فاتح',
  save: 'حفظ', send: 'إرسال', accept: 'قبول', decline: 'رفض',
  wardrobe: 'خزانة الملابس', learn: 'تعلم', trophy: 'كأس',
  back: 'رجوع', close: 'إغلاق', refresh: 'تحديث',
};

const hi: Dict = {
  home: 'होम', markets: 'बाज़ार', portfolio: 'पोर्टफोलियो', social: 'सोशल',
  profile: 'प्रोफ़ाइल', leaderboard: 'लीडरबोर्ड', trade: 'ट्रेड',
  buy: 'खरीदें', sell: 'बेचें', cancel: 'रद्द करें', confirm: 'पुष्टि करें',
  loading: 'लोड हो रहा है...', settings: 'सेटिंग्स',
  language: 'भाषा', select_language: 'भाषा चुनें', search_languages: 'भाषा खोजें...',
  sign_out: 'साइन आउट', you: 'आप', global: 'वैश्विक', local: 'स्थानीय',
  friends: 'दोस्त', messages: 'संदेश', dark: 'डार्क', light: 'लाइट',
  save: 'सहेजें', send: 'भेजें', accept: 'स्वीकार', decline: 'अस्वीकार',
  wardrobe: 'अलमारी', learn: 'सीखें', trophy: 'ट्रॉफी',
  back: 'वापस', close: 'बंद करें', refresh: 'रिफ्रेश',
};

const ru: Dict = {
  home: 'Главная', markets: 'Рынки', portfolio: 'Портфель', social: 'Общение',
  profile: 'Профиль', leaderboard: 'Рейтинг', trade: 'Торговля',
  market_movers: 'Движения рынка', top_gainers: 'Лидеры роста', top_losers: 'Лидеры падения',
  buy: 'Купить', sell: 'Продать', cancel: 'Отмена', confirm: 'Подтвердить',
  loading: 'Загрузка...', no_results: 'Нет результатов', settings: 'Настройки',
  language: 'Язык', select_language: 'Выберите язык', search_languages: 'Поиск языков...',
  sign_out: 'Выйти', you: 'ВЫ', global: 'Глобальный', local: 'Местный',
  friends: 'Друзья', messages: 'Сообщения', clubs: 'Клубы', rankings: 'Рейтинг',
  add_friend: '+ Друг', holdings: 'Позиции', achievements: 'Достижения',
  dark: 'Тёмная', light: 'Светлая', mode: 'Режим', appearance: 'Оформление',
  save: 'Сохранить', send: 'Отправить', accept: 'Принять', decline: 'Отклонить',
  wardrobe: 'Гардероб', preview: 'Предпросмотр', learn: 'Учиться', trophy: 'Трофей',
  back: 'Назад', close: 'Закрыть', refresh: 'Обновить',
  cash_balance: 'Баланс', shares: 'акции', volume: 'Объём',
  watch: 'Следить', watching: 'Отслеживается', recent_news: 'Последние новости',
};

const tr: Dict = {
  home: 'Ana Sayfa', markets: 'Piyasalar', portfolio: 'Portföy', social: 'Sosyal',
  profile: 'Profil', leaderboard: 'Sıralama', trade: 'İşlem',
  buy: 'Al', sell: 'Sat', cancel: 'İptal', confirm: 'Onayla',
  loading: 'Yükleniyor...', settings: 'Ayarlar',
  language: 'Dil', select_language: 'Dil Seçin', search_languages: 'Dil ara...',
  sign_out: 'Çıkış Yap', you: 'SEN', global: 'Küresel', local: 'Yerel',
  friends: 'Arkadaşlar', messages: 'Mesajlar', dark: 'Karanlık', light: 'Aydınlık',
  save: 'Kaydet', send: 'Gönder', accept: 'Kabul Et', decline: 'Reddet',
  wardrobe: 'Gardırop', learn: 'Öğren', trophy: 'Kupa',
  back: 'Geri', close: 'Kapat', refresh: 'Yenile',
};

const it: Dict = {
  home: 'Home', markets: 'Mercati', portfolio: 'Portafoglio', social: 'Sociale',
  profile: 'Profilo', leaderboard: 'Classifica', trade: 'Negozia',
  buy: 'Compra', sell: 'Vendi', cancel: 'Annulla', confirm: 'Conferma',
  loading: 'Caricamento...', settings: 'Impostazioni',
  language: 'Lingua', select_language: 'Seleziona Lingua', search_languages: 'Cerca lingua...',
  sign_out: 'Esci', you: 'TU', global: 'Globale', local: 'Locale',
  friends: 'Amici', messages: 'Messaggi', dark: 'Scuro', light: 'Chiaro',
  save: 'Salva', send: 'Invia', accept: 'Accetta', decline: 'Rifiuta',
  wardrobe: 'Guardaroba', learn: 'Impara', trophy: 'Trofeo',
  back: 'Indietro', close: 'Chiudi', refresh: 'Aggiorna',
};

const nl: Dict = {
  home: 'Start', markets: 'Markten', portfolio: 'Portefeuille', social: 'Sociaal',
  profile: 'Profiel', leaderboard: 'Ranglijst', trade: 'Handelen',
  buy: 'Kopen', sell: 'Verkopen', cancel: 'Annuleren', confirm: 'Bevestigen',
  loading: 'Laden...', settings: 'Instellingen',
  language: 'Taal', select_language: 'Kies Taal', search_languages: 'Zoek talen...',
  sign_out: 'Uitloggen', you: 'JIJ', global: 'Globaal', local: 'Lokaal',
  friends: 'Vrienden', messages: 'Berichten', dark: 'Donker', light: 'Licht',
  save: 'Opslaan', send: 'Verzenden', accept: 'Accepteren', decline: 'Weigeren',
  wardrobe: 'Kledingkast', learn: 'Leren', trophy: 'Trofee',
  back: 'Terug', close: 'Sluiten', refresh: 'Vernieuwen',
};

const pl: Dict = {
  home: 'Strona Główna', markets: 'Rynki', portfolio: 'Portfel', social: 'Społeczność',
  profile: 'Profil', leaderboard: 'Ranking', trade: 'Handluj',
  buy: 'Kup', sell: 'Sprzedaj', cancel: 'Anuluj', confirm: 'Potwierdź',
  loading: 'Ładowanie...', settings: 'Ustawienia',
  language: 'Język', select_language: 'Wybierz Język', search_languages: 'Szukaj języków...',
  sign_out: 'Wyloguj', you: 'TY', global: 'Globalny', local: 'Lokalny',
  friends: 'Znajomi', messages: 'Wiadomości', dark: 'Ciemny', light: 'Jasny',
  save: 'Zapisz', send: 'Wyślij', accept: 'Akceptuj', decline: 'Odrzuć',
  wardrobe: 'Garderoba', learn: 'Nauka', trophy: 'Trofeum',
  back: 'Wstecz', close: 'Zamknij', refresh: 'Odśwież',
};

const uk: Dict = {
  home: 'Головна', markets: 'Ринки', portfolio: 'Портфель', social: 'Соціальне',
  profile: 'Профіль', leaderboard: 'Рейтинг', trade: 'Торгівля',
  buy: 'Купити', sell: 'Продати', cancel: 'Скасувати', confirm: 'Підтвердити',
  loading: 'Завантаження...', settings: 'Налаштування',
  language: 'Мова', select_language: 'Обрати Мову', search_languages: 'Пошук мов...',
  sign_out: 'Вийти', you: 'ВИ', friends: 'Друзі', messages: 'Повідомлення',
  dark: 'Темна', light: 'Світла', save: 'Зберегти', send: 'Надіслати',
  wardrobe: 'Гардероб', learn: 'Вчитися', trophy: 'Трофей',
};

const sv: Dict = {
  home: 'Hem', markets: 'Marknader', portfolio: 'Portfölj', social: 'Socialt',
  profile: 'Profil', leaderboard: 'Topplista', trade: 'Handla',
  buy: 'Köp', sell: 'Sälj', cancel: 'Avbryt', confirm: 'Bekräfta',
  loading: 'Laddar...', settings: 'Inställningar',
  language: 'Språk', select_language: 'Välj Språk', search_languages: 'Sök språk...',
  sign_out: 'Logga ut', you: 'DU', friends: 'Vänner', messages: 'Meddelanden',
  dark: 'Mörkt', light: 'Ljust', save: 'Spara', send: 'Skicka',
  wardrobe: 'Garderob', learn: 'Lär dig', trophy: 'Trofé',
};

const da: Dict = {
  home: 'Hjem', markets: 'Markeder', portfolio: 'Portefølje', social: 'Socialt',
  profile: 'Profil', leaderboard: 'Rangliste', trade: 'Handel',
  buy: 'Køb', sell: 'Sælg', cancel: 'Annuller', confirm: 'Bekræft',
  loading: 'Indlæser...', settings: 'Indstillinger',
  language: 'Sprog', select_language: 'Vælg Sprog', search_languages: 'Søg sprog...',
  sign_out: 'Log ud', you: 'DIG', friends: 'Venner', messages: 'Beskeder',
  dark: 'Mørk', light: 'Lys', save: 'Gem', send: 'Send',
  wardrobe: 'Garderobe', learn: 'Lær', trophy: 'Trofæ',
};

const no_lang: Dict = {
  home: 'Hjem', markets: 'Markeder', portfolio: 'Portefølje', social: 'Sosialt',
  profile: 'Profil', leaderboard: 'Toppliste', trade: 'Handle',
  buy: 'Kjøp', sell: 'Selg', cancel: 'Avbryt', confirm: 'Bekreft',
  loading: 'Laster...', settings: 'Innstillinger',
  language: 'Språk', select_language: 'Velg Språk', search_languages: 'Søk språk...',
  sign_out: 'Logg ut', you: 'DU', friends: 'Venner', messages: 'Meldinger',
  dark: 'Mørk', light: 'Lys', save: 'Lagre', send: 'Send',
  wardrobe: 'Garderobe', learn: 'Lær', trophy: 'Trofé',
};

const fi: Dict = {
  home: 'Koti', markets: 'Markkinat', portfolio: 'Salkku', social: 'Sosiaalinen',
  profile: 'Profiili', leaderboard: 'Tulostaulukko', trade: 'Kauppa',
  buy: 'Osta', sell: 'Myy', cancel: 'Peruuta', confirm: 'Vahvista',
  loading: 'Ladataan...', settings: 'Asetukset',
  language: 'Kieli', select_language: 'Valitse Kieli', search_languages: 'Etsi kieliä...',
  sign_out: 'Kirjaudu ulos', you: 'SINÄ', friends: 'Ystävät', messages: 'Viestit',
  dark: 'Tumma', light: 'Vaalea', save: 'Tallenna', send: 'Lähetä',
  wardrobe: 'Vaatekaappi', learn: 'Oppia', trophy: 'Palkinto',
};

const el: Dict = {
  home: 'Αρχική', markets: 'Αγορές', portfolio: 'Χαρτοφυλάκιο', social: 'Κοινωνικά',
  profile: 'Προφίλ', leaderboard: 'Κατάταξη', trade: 'Συναλλαγή',
  buy: 'Αγορά', sell: 'Πώληση', cancel: 'Ακύρωση', confirm: 'Επιβεβαίωση',
  loading: 'Φόρτωση...', settings: 'Ρυθμίσεις',
  language: 'Γλώσσα', select_language: 'Επιλογή Γλώσσας', search_languages: 'Αναζήτηση...',
  sign_out: 'Αποσύνδεση', you: 'ΕΣΥ', friends: 'Φίλοι', messages: 'Μηνύματα',
  dark: 'Σκούρο', light: 'Φωτεινό', save: 'Αποθήκευση', send: 'Αποστολή',
  wardrobe: 'Ντουλάπα', learn: 'Μάθηση', trophy: 'Τρόπαιο',
};

const th: Dict = {
  home: 'หน้าหลัก', markets: 'ตลาด', portfolio: 'พอร์ตโฟลิโอ', social: 'สังคม',
  profile: 'โปรไฟล์', leaderboard: 'อันดับ', trade: 'ซื้อขาย',
  buy: 'ซื้อ', sell: 'ขาย', cancel: 'ยกเลิก', confirm: 'ยืนยัน',
  loading: 'กำลังโหลด...', settings: 'ตั้งค่า',
  language: 'ภาษา', select_language: 'เลือกภาษา', search_languages: 'ค้นหาภาษา...',
  sign_out: 'ออกจากระบบ', you: 'คุณ', friends: 'เพื่อน', messages: 'ข้อความ',
  dark: 'มืด', light: 'สว่าง', save: 'บันทึก', send: 'ส่ง',
  wardrobe: 'ตู้เสื้อผ้า', learn: 'เรียนรู้', trophy: 'ถ้วยรางวัล',
};

const vi: Dict = {
  home: 'Trang Chủ', markets: 'Thị Trường', portfolio: 'Danh Mục', social: 'Xã Hội',
  profile: 'Hồ Sơ', leaderboard: 'Bảng Xếp Hạng', trade: 'Giao Dịch',
  buy: 'Mua', sell: 'Bán', cancel: 'Hủy', confirm: 'Xác Nhận',
  loading: 'Đang tải...', settings: 'Cài Đặt',
  language: 'Ngôn Ngữ', select_language: 'Chọn Ngôn Ngữ', search_languages: 'Tìm ngôn ngữ...',
  sign_out: 'Đăng Xuất', you: 'BẠN', friends: 'Bạn Bè', messages: 'Tin Nhắn',
  dark: 'Tối', light: 'Sáng', save: 'Lưu', send: 'Gửi',
  wardrobe: 'Tủ Quần Áo', learn: 'Học', trophy: 'Cúp',
};

const id: Dict = {
  home: 'Beranda', markets: 'Pasar', portfolio: 'Portofolio', social: 'Sosial',
  profile: 'Profil', leaderboard: 'Papan Peringkat', trade: 'Perdagangan',
  buy: 'Beli', sell: 'Jual', cancel: 'Batal', confirm: 'Konfirmasi',
  loading: 'Memuat...', settings: 'Pengaturan',
  language: 'Bahasa', select_language: 'Pilih Bahasa', search_languages: 'Cari bahasa...',
  sign_out: 'Keluar', you: 'ANDA', friends: 'Teman', messages: 'Pesan',
  dark: 'Gelap', light: 'Terang', save: 'Simpan', send: 'Kirim',
  wardrobe: 'Lemari Pakaian', learn: 'Belajar', trophy: 'Piala',
};

const ms: Dict = {
  home: 'Laman Utama', markets: 'Pasaran', portfolio: 'Portfolio', social: 'Sosial',
  profile: 'Profil', leaderboard: 'Papan Markah', trade: 'Dagangan',
  buy: 'Beli', sell: 'Jual', cancel: 'Batal', confirm: 'Sahkan',
  loading: 'Memuatkan...', settings: 'Tetapan',
  language: 'Bahasa', select_language: 'Pilih Bahasa', search_languages: 'Cari bahasa...',
  sign_out: 'Log Keluar', you: 'ANDA', friends: 'Rakan', messages: 'Mesej',
  dark: 'Gelap', light: 'Cerah', save: 'Simpan', send: 'Hantar',
  wardrobe: 'Almari Pakaian', learn: 'Belajar', trophy: 'Trofi',
};

const bn: Dict = {
  home: 'হোম', markets: 'বাজার', portfolio: 'পোর্টফোলিও', social: 'সামাজিক',
  profile: 'প্রোফাইল', leaderboard: 'লিডারবোর্ড', trade: 'ট্রেড',
  buy: 'কিনুন', sell: 'বিক্রি', cancel: 'বাতিল', confirm: 'নিশ্চিত',
  loading: 'লোড হচ্ছে...', settings: 'সেটিংস',
  language: 'ভাষা', select_language: 'ভাষা নির্বাচন', search_languages: 'ভাষা খুঁজুন...',
  sign_out: 'সাইন আউট', you: 'আপনি', friends: 'বন্ধু', messages: 'বার্তা',
  dark: 'ডার্ক', light: 'লাইট', save: 'সংরক্ষণ', send: 'পাঠান',
  wardrobe: 'পোশাক ঘর', learn: 'শিখুন', trophy: 'ট্রফি',
};

const sw: Dict = {
  home: 'Nyumbani', markets: 'Masoko', portfolio: 'Mkoba', social: 'Jamii',
  profile: 'Wasifu', leaderboard: 'Orodha ya Viongozi', trade: 'Biashara',
  buy: 'Nunua', sell: 'Uza', cancel: 'Ghairi', confirm: 'Thibitisha',
  loading: 'Inapakia...', settings: 'Mipangilio',
  language: 'Lugha', select_language: 'Chagua Lugha', search_languages: 'Tafuta lugha...',
  sign_out: 'Ondoka', you: 'WEWE', friends: 'Marafiki', messages: 'Ujumbe',
  dark: 'Giza', light: 'Mwanga', save: 'Hifadhi', send: 'Tuma',
  wardrobe: 'Kabati la Nguo', learn: 'Jifunze', trophy: 'Tuzo',
};

const ro: Dict = {
  home: 'Acasă', markets: 'Piețe', portfolio: 'Portofoliu', social: 'Social',
  profile: 'Profil', leaderboard: 'Clasament', trade: 'Tranzacționează',
  buy: 'Cumpără', sell: 'Vinde', cancel: 'Anulează', confirm: 'Confirmă',
  loading: 'Se încarcă...', settings: 'Setări',
  language: 'Limbă', select_language: 'Selectează Limba', search_languages: 'Caută limbi...',
  sign_out: 'Deconectare', you: 'TU', friends: 'Prieteni', messages: 'Mesaje',
  dark: 'Întunecat', light: 'Luminos', save: 'Salvează', send: 'Trimite',
  wardrobe: 'Garderobă', learn: 'Învață', trophy: 'Trofeu',
};

const cs: Dict = {
  home: 'Domů', markets: 'Trhy', portfolio: 'Portfolio', social: 'Sociální',
  profile: 'Profil', leaderboard: 'Žebříček', trade: 'Obchod',
  buy: 'Koupit', sell: 'Prodat', cancel: 'Zrušit', confirm: 'Potvrdit',
  loading: 'Načítání...', settings: 'Nastavení',
  language: 'Jazyk', select_language: 'Vyberte Jazyk', search_languages: 'Hledat jazyky...',
  sign_out: 'Odhlásit', you: 'TY', friends: 'Přátelé', messages: 'Zprávy',
  dark: 'Tmavý', light: 'Světlý', save: 'Uložit', send: 'Odeslat',
  wardrobe: 'Šatník', learn: 'Učit se', trophy: 'Trofej',
};

const hu: Dict = {
  home: 'Főoldal', markets: 'Piacok', portfolio: 'Portfólió', social: 'Közösség',
  profile: 'Profil', leaderboard: 'Ranglista', trade: 'Kereskedés',
  buy: 'Vásárlás', sell: 'Eladás', cancel: 'Mégse', confirm: 'Megerősítés',
  loading: 'Betöltés...', settings: 'Beállítások',
  language: 'Nyelv', select_language: 'Nyelv Kiválasztása', search_languages: 'Nyelv keresése...',
  sign_out: 'Kijelentkezés', you: 'TE', friends: 'Barátok', messages: 'Üzenetek',
  dark: 'Sötét', light: 'Világos', save: 'Mentés', send: 'Küldés',
  wardrobe: 'Gardrób', learn: 'Tanulás', trophy: 'Trófea',
};

const he: Dict = {
  home: 'בית', markets: 'שווקים', portfolio: 'תיק השקעות', social: 'חברתי',
  profile: 'פרופיל', leaderboard: 'טבלת דירוג', trade: 'מסחר',
  buy: 'קנה', sell: 'מכור', cancel: 'ביטול', confirm: 'אישור',
  loading: '...טוען', settings: 'הגדרות',
  language: 'שפה', select_language: 'בחר שפה', search_languages: '...חפש שפות',
  sign_out: 'התנתק', you: 'אתה', friends: 'חברים', messages: 'הודעות',
  dark: 'כהה', light: 'בהיר', save: 'שמור', send: 'שלח',
  wardrobe: 'ארון בגדים', learn: 'למד', trophy: 'גביע',
};

const fa: Dict = {
  home: 'خانه', markets: 'بازارها', portfolio: 'سبد سهام', social: 'اجتماعی',
  profile: 'پروفایل', leaderboard: 'جدول رتبه‌بندی', trade: 'معامله',
  buy: 'خرید', sell: 'فروش', cancel: 'لغو', confirm: 'تأیید',
  loading: '...در حال بارگذاری', settings: 'تنظیمات',
  language: 'زبان', select_language: 'انتخاب زبان', search_languages: '...جستجوی زبان',
  sign_out: 'خروج', you: 'شما', friends: 'دوستان', messages: 'پیام‌ها',
  dark: 'تیره', light: 'روشن', save: 'ذخیره', send: 'ارسال',
  wardrobe: 'کمد لباس', learn: 'یادگیری', trophy: 'جام',
};

const ur: Dict = {
  home: 'ہوم', markets: 'مارکیٹس', portfolio: 'پورٹ فولیو', social: 'سوشل',
  profile: 'پروفائل', leaderboard: 'لیڈر بورڈ', trade: 'تجارت',
  buy: 'خریدیں', sell: 'بیچیں', cancel: 'منسوخ', confirm: 'تصدیق',
  loading: '...لوڈ ہو رہا ہے', settings: 'ترتیبات',
  language: 'زبان', select_language: 'زبان منتخب کریں', search_languages: '...زبان تلاش کریں',
  sign_out: 'سائن آؤٹ', you: 'آپ', friends: 'دوست', messages: 'پیغامات',
  dark: 'ڈارک', light: 'لائٹ', save: 'محفوظ', send: 'بھیجیں',
  wardrobe: 'الماری', learn: 'سیکھیں', trophy: 'ٹرافی',
};

const tl: Dict = {
  home: 'Tahanan', markets: 'Merkado', portfolio: 'Portfolio', social: 'Social',
  profile: 'Profile', leaderboard: 'Ranggo', trade: 'Kalakalan',
  buy: 'Bumili', sell: 'Ibenta', cancel: 'Kanselahin', confirm: 'Kumpirmahin',
  loading: 'Naglo-load...', settings: 'Mga Setting',
  language: 'Wika', select_language: 'Pumili ng Wika', search_languages: 'Maghanap ng wika...',
  sign_out: 'Mag-sign out', you: 'IKAW', friends: 'Kaibigan', messages: 'Mensahe',
  dark: 'Madilim', light: 'Maliwanag', save: 'I-save', send: 'Ipadala',
  wardrobe: 'Aparador', learn: 'Matuto', trophy: 'Trofeo',
};

const af: Dict = {
  home: 'Tuis', markets: 'Markte', portfolio: 'Portefeulje', social: 'Sosiaal',
  profile: 'Profiel', leaderboard: 'Ranglys', trade: 'Handel',
  buy: 'Koop', sell: 'Verkoop', cancel: 'Kanselleer', confirm: 'Bevestig',
  loading: 'Laai...', settings: 'Instellings',
  language: 'Taal', select_language: 'Kies Taal', search_languages: 'Soek tale...',
  sign_out: 'Teken Uit', you: 'JY', friends: 'Vriende', messages: 'Boodskappe',
  dark: 'Donker', light: 'Lig', save: 'Stoor', send: 'Stuur',
  wardrobe: 'Klerekas', learn: 'Leer', trophy: 'Trofee',
};

// ─── Combined dictionary ─────────────────────────────────────────────────────

const translations: Record<string, Dict> = {
  en, es, fr, de, pt, it, nl, ru, uk, pl, tr, ar, hi, bn, zh,
  'zh-TW': zh, // Traditional Chinese uses Simplified as base
  ja, ko, th, vi, id, ms, tl, sw, sv, da, no: no_lang, fi, el,
  he, ro, cs, hu, fa, ur, af,
  // Languages without specific dictionaries fall back to English via the t() function
};

// ─── Translation functions ───────────────────────────────────────────────────

// ─── Auto-translation cache ──────────────────────────────────────────────────

// Runtime cache for auto-translated strings (persists in memory for session)
const autoCache: Record<string, Record<string, string>> = {};
// Track pending fetches to avoid duplicate requests
const pendingFetches = new Set<string>();

/**
 * Auto-translate a string using Google Translate's free API.
 * Results are cached in memory. Returns English text immediately while
 * the translation loads, then triggers a store update to re-render.
 */
async function autoTranslate(text: string, targetLang: string): Promise<string> {
  const cacheKey = `${targetLang}:${text}`;
  if (autoCache[targetLang]?.[text]) return autoCache[targetLang][text];
  if (pendingFetches.has(cacheKey)) return text; // Already fetching

  pendingFetches.add(cacheKey);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const translated = (data?.[0] as Array<[string]>)?.map(s => s[0]).join('') || text;
      if (!autoCache[targetLang]) autoCache[targetLang] = {};
      autoCache[targetLang][text] = translated;
      // Trigger re-render by nudging the store
      const current = useAppStore.getState().appLanguage;
      if (current === targetLang) {
        useAppStore.setState({ appLanguage: targetLang });
      }
      return translated;
    }
  } catch { /* fall back to English */ }
  finally { pendingFetches.delete(cacheKey); }
  return text;
}

/**
 * Batch auto-translate all English keys for a language.
 * Called once when a language without a dictionary is selected.
 */
async function preloadAutoTranslations(targetLang: string): Promise<void> {
  if (translations[targetLang] || autoCache[targetLang]) return;
  // Translate the most important UI strings in batches
  const keys = Object.keys(translations.en);
  const values = Object.values(translations.en);
  // Batch in groups of 20 to avoid hitting rate limits
  for (let i = 0; i < values.length; i += 20) {
    const batch = values.slice(i, i + 20);
    const batchKeys = keys.slice(i, i + 20);
    try {
      const joined = batch.join('\n');
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(joined)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const translated = (data?.[0] as Array<[string]>)?.map(s => s[0]).join('') || joined;
        const parts = translated.split('\n');
        if (!autoCache[targetLang]) autoCache[targetLang] = {};
        parts.forEach((part, idx) => {
          if (idx < batchKeys.length && part.trim()) {
            autoCache[targetLang][translations.en[batchKeys[idx]]] = part.trim();
          }
        });
      }
    } catch { /* continue with next batch */ }
  }
  // Trigger re-render
  const current = useAppStore.getState().appLanguage;
  if (current === targetLang) {
    useAppStore.setState({ appLanguage: targetLang });
  }
}

// ─── Translation functions ───────────────────────────────────────────────────

function lookup(lang: string, key: string): string {
  // 1. Check built-in dictionary
  if (translations[lang]?.[key]) return translations[lang][key];
  // 2. Check auto-translation cache (keyed by English text)
  const enText = translations.en[key] ?? key;
  if (autoCache[lang]?.[enText]) return autoCache[lang][enText];
  // 3. If no dictionary exists for this language, kick off auto-translate
  if (!translations[lang] && lang !== 'en' && !autoCache[lang]) {
    preloadAutoTranslations(lang);
  }
  // 4. Fall back to English
  return enText;
}

/**
 * Translate a key (non-reactive, for use outside components).
 */
export function t(key: string): string {
  const lang = useAppStore.getState().appLanguage ?? 'en';
  return lookup(lang, key);
}

/**
 * React hook that re-renders the component when the language changes.
 * Usage:  const t = useT();
 */
export function useT(): (key: string) => string {
  const lang = useAppStore((s) => s.appLanguage) ?? 'en';
  return (key: string) => lookup(lang, key);
}
