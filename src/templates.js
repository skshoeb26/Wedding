// Template registry. Each template provides a runtime script and stylesheet
// that render the shared configuration schema.

import { THEME_PRESETS } from './schema.js';

export const SHARED_FILES = {
  core: 'templates/shared/core.js',
  art: 'templates/shared/art.js',
  boot: 'templates/shared/boot.js',
  css: 'templates/shared/base.css'
};

export const TEMPLATES = [
  {
    id: 'floral-book',
    name: 'Floral Book',
    tagline: 'Ornate book cover with page-turn animation',
    description:
      'A pearl curtain parts to reveal a dusty-rose and gold book. Guests scroll or swipe to turn its pages, from the blessings and invitation to each event, and finish on a back cover with a live countdown and venue links.',
    features: ['Curtain reveal', 'Scroll page turns', 'Arabic calligraphy', 'Countdown', 'Music control'],
    runtime: 'templates/floral-book/runtime.js',
    css: 'templates/floral-book/template.css',
    thumbnailVariant: 'book',
    preset: 'dusty-rose',
    curtain: true,
    recommendedExport: 'zip'
  },
  {
    id: 'garden-scroll',
    name: 'Garden Scroll',
    tagline: 'A single elegant scrolling page',
    description:
      'A floral arch hero followed by gently revealed sections. Ideal for longer content and quick sharing on messaging apps.',
    features: ['Scroll reveal', 'Event cards', 'Countdown', 'Music control'],
    runtime: 'templates/garden-scroll/runtime.js',
    css: 'templates/garden-scroll/template.css',
    thumbnailVariant: 'scroll',
    preset: 'sage-ivory',
    curtain: true,
    recommendedExport: 'zip'
  },
  {
    id: 'sealed-envelope',
    name: 'Sealed Envelope',
    tagline: 'Tap the wax seal to open the letter',
    description:
      'A paper envelope closed with a monogrammed wax seal. The flap lifts, the letter slides out, and the details unfold as elegant cards below.',
    features: ['Envelope opening', 'Wax seal monogram', 'Countdown', 'Music control'],
    runtime: 'templates/sealed-envelope/runtime.js',
    css: 'templates/sealed-envelope/template.css',
    thumbnailVariant: 'envelope',
    preset: 'dusty-rose',
    recommendedExport: 'zip'
  },
  {
    id: 'royal-doors',
    name: 'Royal Doors',
    tagline: 'Carved arched doors swing open',
    description:
      'A carved doorway set in a gold arch. Guests tap the door rings, the doors swing open onto the couple\'s names, and the details continue in arch-topped panels.',
    features: ['Door opening', 'Arch panels', 'Countdown', 'Music control'],
    runtime: 'templates/royal-doors/runtime.js',
    css: 'templates/royal-doors/template.css',
    thumbnailVariant: 'doors',
    preset: 'emerald-gold',
    recommendedExport: 'zip'
  },
  {
    id: 'story-cards',
    name: 'Story Cards',
    tagline: 'Tap through full-screen story slides',
    description:
      'Full-screen slides that play like a social-media story, with progress bars and auto-advance. Tap the right side to go forward, the left side to go back, and press and hold to pause.',
    features: ['Story slides', 'Auto-advance', 'Countdown', 'Music control'],
    runtime: 'templates/story-cards/runtime.js',
    css: 'templates/story-cards/template.css',
    thumbnailVariant: 'stories',
    preset: 'blush-burgundy',
    curtain: true,
    recommendedExport: 'zip'
  },
  {
    id: 'moonlit-night',
    name: 'Moonlit Night',
    tagline: 'Lanterns glow under a crescent moon',
    description:
      'A night sky with twinkling stars, a crescent moon and hanging lanterns that light up at a tap. The details glow in gold-framed sections as guests scroll.',
    features: ['Lantern glow', 'Starry sky', 'Countdown', 'Music control'],
    runtime: 'templates/moonlit-night/runtime.js',
    css: 'templates/moonlit-night/template.css',
    thumbnailVariant: 'moon',
    preset: 'midnight-gold',
    recommendedExport: 'zip'
  }
];

export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

export function getTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

// Switch template. Colours that still match a built-in palette follow the
// new template's suggested palette; customised colours are kept.
export function switchTemplate(config, id) {
  const t = getTemplate(id);
  config.template = t.id;
  const colors = config.theme.colors;
  const onPreset = Object.values(THEME_PRESETS).some((p) =>
    Object.entries(p.colors).every(([k, v]) => (colors[k] || '').toLowerCase() === v));
  if (onPreset && t.preset && THEME_PRESETS[t.preset]) {
    config.theme.preset = t.preset;
    config.theme.colors = { ...THEME_PRESETS[t.preset].colors };
  }
  return config;
}

// Locally bundled OFL fonts. `families` maps a theme font name to its files.
export const FONT_FILES = {
  'Great Vibes': [
    { file: 'great-vibes-latin-400-normal.woff2', weight: 400, style: 'normal', range: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' },
    { file: 'great-vibes-latin-ext-400-normal.woff2', weight: 400, style: 'normal', range: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' }
  ],
  'Cormorant Garamond': [
    { file: 'cormorant-garamond-latin-400-normal.woff2', weight: 400, style: 'normal' },
    { file: 'cormorant-garamond-latin-400-italic.woff2', weight: 400, style: 'italic' },
    { file: 'cormorant-garamond-latin-600-normal.woff2', weight: 600, style: 'normal' }
  ],
  Marcellus: [{ file: 'marcellus-latin-400-normal.woff2', weight: 400, style: 'normal' }],
  Amiri: [
    { file: 'amiri-arabic-400-normal.woff2', weight: 400, style: 'normal', range: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFC' },
    { file: 'amiri-arabic-700-normal.woff2', weight: 700, style: 'normal', range: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFC' }
  ],
  'Aref Ruqaa': [
    { file: 'aref-ruqaa-arabic-700-normal.woff2', weight: '400 700', style: 'normal', range: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFC' }
  ]
};

export const FONT_LICENSES = {
  'Great Vibes': 'LICENSE-great-vibes.txt',
  'Cormorant Garamond': 'LICENSE-cormorant-garamond.txt',
  Marcellus: 'LICENSE-marcellus.txt',
  Amiri: 'LICENSE-amiri.txt',
  'Aref Ruqaa': 'LICENSE-aref-ruqaa.txt'
};

export function fontsForConfig(config) {
  const names = new Set(Object.values(config.theme.fonts));
  return [...names].filter((n) => FONT_FILES[n]);
}
