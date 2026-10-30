// Invitation configuration schema, defaults and validation.
//
// The configuration is split into: template selection, invitation data,
// optional sections, theme, animation, asset references and site metadata.

import { clone, isPlainObject } from './util.js';

export const SCHEMA_VERSION = 1;

export const ASSET_SLOTS = {
  background: { label: 'Background artwork', kind: 'image', folder: 'images', file: 'background' },
  couplePhoto: { label: 'Couple photo', kind: 'image', folder: 'images', file: 'couple-photo' },
  music: { label: 'Background music', kind: 'audio', folder: 'audio', file: 'background-music' }
};

export const FONT_CHOICES = {
  script: ['Great Vibes', 'Cormorant Garamond', 'Marcellus'],
  heading: ['Cormorant Garamond', 'Marcellus', 'Georgia', 'System Sans'],
  body: ['Cormorant Garamond', 'Georgia', 'Marcellus', 'System Sans'],
  arabic: ['Amiri', 'Aref Ruqaa'],
  calligraphy: ['Aref Ruqaa', 'Amiri']
};

export const THEME_PRESETS = {
  'dusty-rose': {
    name: 'Dusty Rose & Gold',
    colors: { primary: '#a4605b', rose: '#e6b5ad', accent: '#c19e6a', paper: '#fcf1ec', ink: '#6e4442', background: '#d9a39a' }
  },
  'sage-ivory': {
    name: 'Sage & Ivory',
    colors: { primary: '#5f7358', rose: '#e3c4b8', accent: '#b39a62', paper: '#fdfbf4', ink: '#38433a', background: '#e3e8da' }
  },
  'midnight-gold': {
    name: 'Midnight & Gold',
    colors: { primary: '#2f3b5c', rose: '#cfa7a9', accent: '#c4a062', paper: '#fdf8ee', ink: '#2a2f40', background: '#d9d4cf' }
  },
  'emerald-gold': {
    name: 'Emerald & Gold',
    colors: { primary: '#1f5246', rose: '#e2c2b0', accent: '#c9a45c', paper: '#fbf6ea', ink: '#24342f', background: '#d6dccf' }
  },
  'blush-burgundy': {
    name: 'Blush & Burgundy',
    colors: { primary: '#7a2e3d', rose: '#e8b4b8', accent: '#b98e57', paper: '#fff8f4', ink: '#45222a', background: '#f4dcdc' }
  }
};

export function createDefaultConfig(templateId = 'floral-book') {
  return {
    schemaVersion: SCHEMA_VERSION,
    template: templateId,
    invitation: {
      heading: 'We cordially invite you to the Nikah & Reception of',
      coverTagline: 'The wedding of',
      openPrompt: '',
      curtainPrompt: 'Pull the strings to open',
      bismillah: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      couple: {
        joiner: '&',
        partner1: {
          name: 'Ayesha',
          fullName: '',
          arabicName: 'عائشة',
          parents: '(D/O Sana & Imran Siddiqui)'
        },
        partner2: {
          name: 'Zayan',
          fullName: '',
          arabicName: 'زيان',
          parents: '(S/O Huma & Faisal Ahmed)'
        }
      },
      familyIntro: '',
      message: '',
      blessings: {
        intro: 'In the name of Allah, the Most Gracious, the Most Merciful, and with the blessings of the Prophet ﷺ',
        heading: 'With the blessings of',
        names: 'Mrs Rukhsana & Mr Yusuf Siddiqui\nMrs Farida & Mr Anwar Ahmed'
      },
      quote: {
        arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ',
        translation: 'Our Lord, grant us from our spouses and offspring comfort to our eyes.',
        reference: 'Surah Al-Furqan · 25:74'
      },
      events: [
        {
          id: 'nikah',
          enabled: true,
          label: 'Nikah',
          date: '2027-02-14',
          time: '11:00',
          endTime: '',
          hijriAuto: true,
          hijriDate: '',
          venueName: 'Al Noor Masjid',
          address: 'Koregaon Park, Pune',
          mapsUrl: '',
          note: 'After Salat ul Zuhr'
        },
        {
          id: 'reception',
          enabled: true,
          label: 'Reception',
          date: '2027-02-15',
          time: '19:30',
          endTime: '',
          hijriAuto: true,
          hijriDate: '',
          venueName: 'Rosewood Banquet Hall',
          address: 'Kalyani Nagar, Pune',
          mapsUrl: '',
          note: 'Onwards'
        }
      ],
      countdown: {
        target: '2027-02-14T11:00',
        utcOffset: '+05:30',
        heading: 'Countdown to the Nikah',
        expiredMessage: 'Alhamdulillah — the celebration has begun!'
      },
      gallery: { heading: 'Our journey begins', caption: '' },
      rsvp: {
        heading: 'Kindly RSVP',
        message: 'Please let us know if you will be able to join us.',
        deadline: '2027-01-31',
        contacts: [
          { name: 'Imran Siddiqui', phone: '+91 98765 43210' },
          { name: 'Faisal Ahmed', phone: '+91 91234 56789' }
        ],
        whatsapp: '',
        whatsappMessage: 'Assalamu alaikum! We would love to attend the wedding.',
        link: ''
      },
      closing: {
        heading: 'Awaiting your presence',
        message: '',
        signature: "Siddiqui's & Ahmed's",
        hashtag: '#AyeshaWedsZayan'
      },
      music: { title: '', startOnOpen: true, volume: 0.7 },
      labels: {}
    },
    sections: {
      bismillah: true,
      coverDate: true,
      blessings: true,
      family: true,
      quote: true,
      events: true,
      hijri: true,
      countdown: true,
      photo: true,
      rsvp: true
    },
    theme: {
      preset: 'dusty-rose',
      colors: clone(THEME_PRESETS['dusty-rose'].colors),
      fonts: {
        script: 'Great Vibes',
        heading: 'Marcellus',
        body: 'Cormorant Garamond',
        arabic: 'Amiri',
        calligraphy: 'Aref Ruqaa'
      },
      textScale: 1
    },
    animation: {
      intro: 'curtain',
      pageTurn: 'flip',
      pageTurnMs: 1000,
      petals: true,
      reducedMotion: 'auto'
    },
    assets: {
      background: null,
      couplePhoto: null,
      music: null
    },
    meta: {
      title: '',
      description: '',
      lang: 'en',
      dir: 'ltr'
    }
  };
}

export function newEvent(index) {
  return {
    id: `event-${Date.now().toString(36)}-${index}`,
    enabled: true,
    label: 'Mehndi Evening',
    date: '',
    time: '',
    endTime: '',
    hijriAuto: true,
    hijriDate: '',
    venueName: '',
    address: '',
    mapsUrl: '',
    note: ''
  };
}

const LIMITS = { events: 8, contacts: 6 };

// Merge `input` onto `defaults`, keeping only keys and types that the schema
// knows. Unknown keys are dropped; wrong types fall back to the default.
function mergeShape(defaults, input) {
  if (Array.isArray(defaults)) return Array.isArray(input) ? input : defaults;
  if (isPlainObject(defaults)) {
    if (!isPlainObject(input)) return clone(defaults);
    const out = {};
    for (const key of Object.keys(defaults)) out[key] = mergeShape(defaults[key], input[key]);
    return out;
  }
  if (defaults === null) return input === undefined ? null : input;
  if (typeof defaults === 'string') return typeof input === 'string' ? input.slice(0, 2000) : defaults;
  if (typeof defaults === 'number') return typeof input === 'number' && Number.isFinite(input) ? input : defaults;
  if (typeof defaults === 'boolean') return typeof input === 'boolean' ? input : defaults;
  return defaults;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalizeAssetRef(ref) {
  if (!isPlainObject(ref) || typeof ref.id !== 'string') return null;
  return {
    id: ref.id.slice(0, 64),
    name: typeof ref.name === 'string' ? ref.name.slice(0, 200) : 'file',
    mime: typeof ref.mime === 'string' ? ref.mime.slice(0, 80) : 'application/octet-stream',
    size: typeof ref.size === 'number' ? ref.size : 0
  };
}

export function normalizeConfig(input, templateIds = ['floral-book', 'garden-scroll', 'sealed-envelope', 'royal-doors', 'story-cards', 'moonlit-night']) {
  const src = isPlainObject(input) ? input : {};
  const templateId = templateIds.includes(src.template) ? src.template : templateIds[0];
  const defaults = createDefaultConfig(templateId);
  const out = mergeShape(defaults, src);
  out.schemaVersion = SCHEMA_VERSION;
  out.template = templateId;

  const eventDefault = newEvent(0);
  out.invitation.events = (Array.isArray(src.invitation?.events) ? src.invitation.events : defaults.invitation.events)
    .slice(0, LIMITS.events)
    .map((e, i) => ({ ...mergeShape(eventDefault, e), id: typeof e?.id === 'string' ? e.id.slice(0, 64) : `event-${i}` }));

  out.invitation.rsvp.contacts = (Array.isArray(src.invitation?.rsvp?.contacts) ? src.invitation.rsvp.contacts : defaults.invitation.rsvp.contacts)
    .slice(0, LIMITS.contacts)
    .map((c) => mergeShape({ name: '', phone: '' }, c));

  const labels = src.invitation?.labels;
  out.invitation.labels = {};
  if (isPlainObject(labels)) {
    for (const [k, v] of Object.entries(labels)) {
      if (typeof v === 'string' && /^[a-zA-Z]{1,20}$/.test(k)) out.invitation.labels[k] = v.slice(0, 60);
    }
  }

  for (const [k, v] of Object.entries(out.theme.colors)) {
    if (!HEX.test(v)) out.theme.colors[k] = defaults.theme.colors[k];
  }
  for (const [k, v] of Object.entries(out.theme.fonts)) {
    if (!FONT_CHOICES[k]?.includes(v)) out.theme.fonts[k] = defaults.theme.fonts[k];
  }
  out.theme.textScale = Math.min(1.3, Math.max(0.8, out.theme.textScale));
  if (!['flip', 'fade', 'slide'].includes(out.animation.pageTurn)) out.animation.pageTurn = 'flip';
  if (!['auto', 'reduce', 'full'].includes(out.animation.reducedMotion)) out.animation.reducedMotion = 'auto';
  if (!['curtain', 'none'].includes(out.animation.intro)) out.animation.intro = 'curtain';
  out.animation.pageTurnMs = Math.min(2500, Math.max(200, Math.round(out.animation.pageTurnMs)));
  out.invitation.music.volume = Math.min(1, Math.max(0, out.invitation.music.volume));
  if (!['ltr', 'rtl'].includes(out.meta.dir)) out.meta.dir = 'ltr';
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(out.meta.lang)) out.meta.lang = 'en';

  for (const slot of Object.keys(ASSET_SLOTS)) out.assets[slot] = normalizeAssetRef(src.assets?.[slot]);
  return out;
}

// Strip per-build data (resolved src URLs) from asset references.
export function stripAssetSources(config) {
  const out = clone(config);
  for (const slot of Object.keys(ASSET_SLOTS)) {
    if (out.assets[slot]) delete out.assets[slot].src;
  }
  return out;
}

export function invitationTitle(config) {
  const p1 = config.invitation.couple.partner1.name.trim() || 'Bride';
  const p2 = config.invitation.couple.partner2.name.trim() || 'Groom';
  return config.meta.title.trim() || `${p1} ${config.invitation.couple.joiner || '&'} ${p2} — Wedding Invitation`;
}
