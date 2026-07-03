export interface RegionInfo {
  countryCode: string
  greeting: string
  lang: string
}

const GREETING_MAP: Record<string, { greeting: string; lang: string }> = {
  US: { greeting: 'Welcome to {name}', lang: 'en' },
  GB: { greeting: 'Welcome to {name}', lang: 'en' },
  AU: { greeting: 'Welcome to {name}', lang: 'en' },
  CA: { greeting: 'Welcome to {name}', lang: 'en' },
  FR: { greeting: 'Bienvenue sur {name}', lang: 'fr' },
  ES: { greeting: 'Bienvenido a {name}', lang: 'es' },
  MX: { greeting: 'Bienvenido a {name}', lang: 'es' },
  AR: { greeting: 'Bienvenido a {name}', lang: 'es' },
  DE: { greeting: 'Willkommen bei {name}', lang: 'de' },
  AT: { greeting: 'Willkommen bei {name}', lang: 'de' },
  CH: { greeting: 'Willkommen bei {name}', lang: 'de' },
  IT: { greeting: 'Benvenuto su {name}', lang: 'it' },
  PT: { greeting: 'Bem-vindo ao {name}', lang: 'pt' },
  BR: { greeting: 'Bem-vindo ao {name}', lang: 'pt' },
  NL: { greeting: 'Welkom bij {name}', lang: 'nl' },
  BE: { greeting: 'Welkom bij {name}', lang: 'nl' },
  SE: { greeting: 'Välkommen till {name}', lang: 'sv' },
  NO: { greeting: 'Velkommen til {name}', lang: 'no' },
  DK: { greeting: 'Velkommen til {name}', lang: 'da' },
  FI: { greeting: 'Tervetuloa {name}', lang: 'fi' },
  PL: { greeting: 'Witaj w {name}', lang: 'pl' },
  RU: { greeting: 'Добро пожаловать в {name}', lang: 'ru' },
  JP: { greeting: '{name}へようこそ', lang: 'ja' },
  KR: { greeting: '{name}에 오신 것을 환영합니다', lang: 'ko' },
  CN: { greeting: '欢迎使用 {name}', lang: 'zh' },
  TW: { greeting: '歡迎使用 {name}', lang: 'zh-Hant' },
  HK: { greeting: '歡迎使用 {name}', lang: 'zh-Hant' },
  IN: { greeting: '{name} में आपका स्वागत है', lang: 'hi' },
  IL: { greeting: 'ברוכים הבאים ל{name}', lang: 'he' },
  SA: { greeting: 'مرحبًا بك في {name}', lang: 'ar' },
  AE: { greeting: 'مرحبًا بك في {name}', lang: 'ar' },
  EG: { greeting: 'مرحبًا بك في {name}', lang: 'ar' },
  TR: { greeting: '{name}\'a hoş geldiniz', lang: 'tr' },
  TH: { greeting: 'ยินดีต้อนรับสู่ {name}', lang: 'th' },
  VN: { greeting: 'Chào mừng đến với {name}', lang: 'vi' },
  ID: { greeting: 'Selamat datang di {name}', lang: 'id' },
  MY: { greeting: 'Selamat datang ke {name}', lang: 'ms' },
  PH: { greeting: 'Maligayang pagdating sa {name}', lang: 'fil' },
  GR: { greeting: 'Καλώς ήρθατε στο {name}', lang: 'el' },
  CZ: { greeting: 'Vítejte v {name}', lang: 'cs' },
  HU: { greeting: 'Üdvözöljük a {name}', lang: 'hu' },
  RO: { greeting: 'Bine ați venit la {name}', lang: 'ro' },
  UA: { greeting: 'Ласкаво просимо до {name}', lang: 'uk' },
  BG: { greeting: 'Добре дошли в {name}', lang: 'bg' },
  HR: { greeting: 'Dobrodošli u {name}', lang: 'hr' },
  SK: { greeting: 'Vitajte v {name}', lang: 'sk' },
  SI: { greeting: 'Dobrodošli v {name}', lang: 'sl' },
  LT: { greeting: 'Sveiki atvykę į {name}', lang: 'lt' },
  LV: { greeting: 'Laipni lūdzam {name}', lang: 'lv' },
  EE: { greeting: 'Tere tulemast {name}', lang: 'et' },
  IS: { greeting: 'Velkomin í {name}', lang: 'is' },
  IE: { greeting: 'Fáilte go {name}', lang: 'ga' },
  NZ: { greeting: 'Welcome to {name}', lang: 'en' },
  ZA: { greeting: 'Welcome to {name}', lang: 'en' },
  SG: { greeting: 'Welcome to {name}', lang: 'en' },
  NG: { greeting: 'Welcome to {name}', lang: 'en' },
  KE: { greeting: 'Welcome to {name}', lang: 'en' },
}

const DEFAULT: RegionInfo = {
  countryCode: 'US',
  greeting: 'Welcome to {name}',
  lang: 'en',
}

export async function kza(): Promise<RegionInfo> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('http://ip-api.com/json/?fields=countryCode', {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return DEFAULT
    const data = await res.json()
    return data?.countryCode
      ? { ...(GREETING_MAP[data.countryCode] ?? DEFAULT), countryCode: data.countryCode }
      : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function formatGreeting(template: string, name: string): string {
  return template.replace('{name}', name || 'Your Workspace')
}
