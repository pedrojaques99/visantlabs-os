import enTranslations from '../locales/en-US.json';
import ptTranslations from '../locales/pt-BR.json';

export interface CurrencyInfo {
  currency: string;
  symbol: string;
  locale: string;
  isBrazilian: boolean;
}

export type Locale = 'en-US' | 'pt-BR';

type TranslationKeys = typeof enTranslations;

const TRANSLATIONS: Record<Locale, TranslationKeys> = {
  'en-US': enTranslations,
  'pt-BR': ptTranslations as any,
};

const LOCALE_STORAGE_KEY = 'mockup-machine-locale';

export const getUserLocale = (): CurrencyInfo => {
  // First, check if user has a stored preference
  const storedLocale = getStoredLocale();
  if (storedLocale) {
    const isBrazilian = storedLocale === 'pt-BR';
    return {
      currency: isBrazilian ? 'BRL' : 'USD',
      symbol: isBrazilian ? 'R$' : '$',
      locale: storedLocale,
      isBrazilian: isBrazilian,
    };
  }

  // If no stored preference, detect from browser
  const browserLocale = navigator.language || (navigator as any).userLanguage || 'en-US';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Check if user is Brazilian
  const isBrazilian =
    browserLocale.toLowerCase().includes('pt-br') ||
    browserLocale.toLowerCase().includes('pt_br') ||
    timezone === 'America/Sao_Paulo' ||
    timezone === 'America/Manaus' ||
    timezone === 'America/Recife' ||
    timezone === 'America/Fortaleza' ||
    timezone === 'America/Belem' ||
    timezone === 'America/Cuiaba' ||
    timezone === 'America/Campo_Grande' ||
    timezone === 'America/Araguaina' ||
    timezone === 'America/Maceio' ||
    timezone === 'America/Bahia' ||
    timezone === 'America/Noronha';

  if (isBrazilian) {
    return {
      currency: 'BRL',
      symbol: 'R$',
      locale: 'pt-BR',
      isBrazilian: true,
    };
  }

  // Default to USD
  return {
    currency: 'USD',
    symbol: '$',
    locale: 'en-US',
    isBrazilian: false,
  };
};

export const getStoredLocale = (): Locale | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return (stored === 'en-US' || stored === 'pt-BR') ? stored : null;
};

export const setStoredLocale = (locale: Locale): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
};

export const getCurrentLocale = (): Locale => {
  return getStoredLocale() || getUserLocale().locale as Locale;
};

export const getTranslations = (locale?: Locale): TranslationKeys => {
  const currentLocale = locale || getCurrentLocale();
  return TRANSLATIONS[currentLocale] || TRANSLATIONS['en-US'];
};

export const translate = (key: string, locale?: Locale, params?: Record<string, string | number>): string => {
  const translations = getTranslations(locale);

  // Navigate through nested keys (e.g., "common.loading")
  const keys = key.split('.');
  let value: any = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k as keyof typeof value];
    } else {
      // Fallback to English if key not found
      const enValue = getTranslations('en-US');
      let fallbackValue: any = enValue;
      for (const fallbackKey of keys) {
        if (fallbackValue && typeof fallbackValue === 'object' && fallbackKey in fallbackValue) {
          fallbackValue = fallbackValue[fallbackKey as keyof typeof fallbackValue];
        } else {
          return key; // Return key if not found anywhere
        }
      }
      value = fallbackValue;
      break;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters in the format {param}
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
      if (paramKey in params) {
        return String(params[paramKey]);
      }
      return match;
    });
  }

  return value;
};

export const formatPrice = (amount: number, currency: string, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Mapping from English tag values to translation keys
const TAG_TRANSLATION_MAP: Record<string, string> = {
  // Category tags
  'Business Card': 'tags.businessCard',
  'Letterhead': 'tags.letterhead',
  'Book Cover': 'tags.bookCover',
  'Magazine Cover': 'tags.magazineCover',
  'Poster': 'tags.poster',
  'Flyer': 'tags.flyer',
  'Box Packaging': 'tags.boxPackaging',
  'Bag Packaging': 'tags.bagPackaging',
  'Pouch Packaging': 'tags.pouchPackaging',
  'Bottle Label': 'tags.bottleLabel',
  'Can Label': 'tags.canLabel',
  'T-shirt': 'tags.tshirt',
  'Hoodie': 'tags.hoodie',
  'Cap': 'tags.cap',
  'Hat': 'tags.hat',
  'Tote Bag': 'tags.toteBag',
  'Phone Screen': 'tags.phoneScreen',
  'Laptop Screen': 'tags.laptopScreen',
  'Website UI': 'tags.websiteUI',
  'Billboard': 'tags.billboard',
  'Signage': 'tags.signage',
  'Mug': 'tags.mug',
  'Cup': 'tags.cup',
  'Wall Art': 'tags.wallArt',
  'Framed Art': 'tags.framedArt',
  'Thick card paper': 'tags.thickCardPaper',
  'Leather logo engrave': 'tags.leatherLogoEngrave',
  'Signage on concrete/wooden wall': 'tags.signageOnWall',
  'Floating business card': 'tags.floatingBusinessCard',
  'Device screen': 'tags.deviceScreen',

  // Branding tags
  'Agriculture': 'tags.branding.agriculture',
  'Casual': 'tags.branding.casual',
  'Corporate': 'tags.branding.corporate',
  'Creative': 'tags.branding.creative',
  'Crypto/Web3': 'tags.branding.cryptoWeb3',
  'Eco-friendly': 'tags.branding.ecofriendly',
  'Energetic': 'tags.branding.energetic',
  'Exclusive': 'tags.branding.exclusive',
  'Fashion': 'tags.branding.fashion',
  'Feminine': 'tags.branding.feminine',
  'Food': 'tags.branding.food',
  'Friendly': 'tags.branding.friendly',
  'Handmade': 'tags.branding.handmade',
  'Health & Wellness': 'tags.branding.healthWellness',
  'Industrial': 'tags.branding.industrial',
  'Kids & Baby': 'tags.branding.kidsBaby',
  'Luxury': 'tags.branding.luxury',
  'Minimalist': 'tags.branding.minimalist',
  'Modern': 'tags.branding.modern',
  'Playful': 'tags.branding.playful',
  'Sport': 'tags.branding.sport',
  'Tech': 'tags.branding.tech',
  'Travel & Hospitality': 'tags.branding.travelHospitality',
  'Vintage': 'tags.branding.vintage',
  'Elegant': 'tags.branding.elegant',

  // Location tags
  'Tokyo': 'tags.location.tokyo',
  'New York': 'tags.location.newYork',
  'Brazil': 'tags.location.brazil',
  'Paris': 'tags.location.paris',
  'London': 'tags.location.london',
  'Nordic': 'tags.location.nordic',
  'California Coast': 'tags.location.californiaCoast',
  'Minimalist Studio': 'tags.location.minimalistStudio',
  'Nature landscape': 'tags.location.natureLandscape',
  'Urban City': 'tags.location.urbanCity',
  'Workspace': 'tags.location.workspace',
  'Grass/Lawn': 'tags.location.grassLawn',
  'Concrete': 'tags.location.concrete',
  'Wooden Slat Wall': 'tags.location.woodenSlatWall',
  'Wooden Table': 'tags.location.woodenTable',
  'Glass Environment': 'tags.location.glassEnvironment',
  'Modern Office': 'tags.location.modernOffice',

  // Angle tags
  'Eye-Level': 'tags.angle.eyeLevel',
  'High Angle': 'tags.angle.highAngle',
  'Low Angle': 'tags.angle.lowAngle',
  'Top-Down (Flat Lay)': 'tags.angle.topDownFlatLay',
  'Dutch Angle': 'tags.angle.dutchAngle',
  "Worm's-Eye View": 'tags.angle.wormsEyeView',

  // Lighting tags
  'Studio Lighting': 'tags.lighting.studioLighting',
  'Golden Hour': 'tags.lighting.goldenHour',
  'Blue Hour': 'tags.lighting.blueHour',
  'Overcast': 'tags.lighting.overcast',
  'Direct Sunlight': 'tags.lighting.directSunlight',
  'Night Scene': 'tags.lighting.nightScene',
  'Cinematic': 'tags.lighting.cinematic',
  'Shadow overlay': 'tags.lighting.shadowOverlay',

  // Effect tags
  'Bokeh': 'tags.effect.bokeh',
  'Motion Blur': 'tags.effect.motionBlur',
  'Vintage Film': 'tags.effect.vintageFilm',
  'Monochrome': 'tags.effect.monochrome',
  'Long Exposure': 'tags.effect.longExposure',
  'Lens Flare': 'tags.effect.lensFlare',
  'High Contrast': 'tags.effect.highContrast',
  'Fish-eye lens': 'tags.effect.fisheyeLens',
  'Halftone': 'tags.effect.halftone',
};

/**
 * Translates a tag from English value to the current locale
 * @param tag - The English tag value (e.g., "Business Card", "Agriculture")
 * @param locale - Optional locale override
 * @returns The translated tag or the original if translation not found
 */
export const translateTag = (tag: string, locale?: Locale): string => {
  if (!tag) return tag;

  const translationKey = TAG_TRANSLATION_MAP[tag];
  if (translationKey) {
    return translate(translationKey, locale);
  }

  // If no mapping found, return original tag
  return tag;
};

