// Declarative description of the editor form. Each field binds to a
// configuration path; the renderer in form.js turns this into DOM controls.

import { FONT_CHOICES, THEME_PRESETS } from './schema.js';

const UTC_OFFSETS = [
  '-08:00', '-07:00', '-06:00', '-05:00', '-04:00', '-03:00', 'Z', '+01:00', '+02:00', '+03:00', '+03:30', '+04:00',
  '+04:30', '+05:00', '+05:30', '+05:45', '+06:00', '+06:30', '+07:00', '+08:00', '+09:00', '+10:00', '+12:00'
].map((v) => ({ value: v, label: v === 'Z' ? 'UTC (+00:00)' : `UTC ${v}` }));

const fontOptions = (key) => FONT_CHOICES[key].map((f) => ({ value: f, label: f }));
const on = (path) => (c) => path.split('.').reduce((o, k) => o?.[k], c) !== false;

export const FORM = [
  {
    id: 'design',
    title: 'Template & colours',
    open: true,
    fields: [
      { type: 'template', path: 'template', label: 'Template' },
      { type: 'preset', path: 'theme.preset', label: 'Colour palette', options: Object.entries(THEME_PRESETS).map(([value, p]) => ({ value, label: p.name })) },
      {
        type: 'group', label: 'Custom colours', className: 'colors', fields: [
          { type: 'color', path: 'theme.colors.primary', label: 'Cover & headings' },
          { type: 'color', path: 'theme.colors.rose', label: 'Floral accent' },
          { type: 'color', path: 'theme.colors.accent', label: 'Gold detail' },
          { type: 'color', path: 'theme.colors.paper', label: 'Paper' },
          { type: 'color', path: 'theme.colors.ink', label: 'Text' },
          { type: 'color', path: 'theme.colors.background', label: 'Background' }
        ]
      },
      { type: 'select', path: 'theme.fonts.script', label: 'Script font (names)', options: fontOptions('script') },
      { type: 'select', path: 'theme.fonts.heading', label: 'Heading font', options: fontOptions('heading') },
      { type: 'select', path: 'theme.fonts.body', label: 'Body font', options: fontOptions('body') },
      { type: 'select', path: 'theme.fonts.arabic', label: 'Arabic text font', options: fontOptions('arabic') },
      { type: 'select', path: 'theme.fonts.calligraphy', label: 'Arabic calligraphy font', options: fontOptions('calligraphy') },
      { type: 'range', path: 'theme.textScale', label: 'Text size', min: 0.8, max: 1.3, step: 0.05, format: (v) => `${Math.round(v * 100)}%` }
    ]
  },
  {
    id: 'couple',
    title: 'Couple',
    open: true,
    fields: [
      { type: 'text', path: 'invitation.couple.partner1.name', label: "Bride's name", maxLength: 60, placeholder: 'Ayesha' },
      { type: 'text', path: 'invitation.couple.partner1.fullName', label: "Bride's full name", maxLength: 120 },
      { type: 'text', path: 'invitation.couple.partner1.arabicName', label: "Bride's name in Arabic (optional)", maxLength: 60, dir: 'rtl' },
      { type: 'text', path: 'invitation.couple.partner1.parents', label: "Bride's parents", maxLength: 200, placeholder: 'Daughter of …' },
      { type: 'text', path: 'invitation.couple.partner2.name', label: "Groom's name", maxLength: 60, placeholder: 'Zayan' },
      { type: 'text', path: 'invitation.couple.partner2.fullName', label: "Groom's full name", maxLength: 120 },
      { type: 'text', path: 'invitation.couple.partner2.arabicName', label: "Groom's name in Arabic (optional)", maxLength: 60, dir: 'rtl' },
      { type: 'text', path: 'invitation.couple.partner2.parents', label: "Groom's parents", maxLength: 200, placeholder: 'Son of …' },
      { type: 'text', path: 'invitation.couple.joiner', label: 'Joining symbol', maxLength: 12, hint: 'For example “&”, “and” or “weds”.' }
    ]
  },
  {
    id: 'opening',
    title: 'Cover & introduction',
    fields: [
      { type: 'text', path: 'invitation.coverTagline', label: 'Cover tagline', maxLength: 120 },
      { type: 'toggle', path: 'sections.coverDate', label: 'Show the first event date on the cover' },
      { type: 'text', path: 'invitation.openPrompt', label: 'Open button text', maxLength: 80 },
      { type: 'toggle', path: 'sections.bismillah', label: 'Show Bismillah' },
      { type: 'text', path: 'invitation.bismillah', label: 'Bismillah text', dir: 'rtl', maxLength: 200, showIf: on('sections.bismillah') },
      { type: 'text', path: 'invitation.heading', label: 'Invitation heading', maxLength: 120 },
      { type: 'toggle', path: 'sections.family', label: 'Show family introduction and parents' },
      { type: 'textarea', path: 'invitation.familyIntro', label: 'Family introduction', maxLength: 800, showIf: on('sections.family') }
    ]
  },
  {
    id: 'message',
    title: 'Message & verse',
    fields: [
      { type: 'textarea', path: 'invitation.message', label: 'Invitation message', maxLength: 1200 },
      { type: 'toggle', path: 'sections.quote', label: 'Show a verse or quotation' },
      { type: 'textarea', path: 'invitation.quote.arabic', label: 'Arabic text', dir: 'rtl', maxLength: 600, showIf: on('sections.quote') },
      { type: 'textarea', path: 'invitation.quote.translation', label: 'Translation', maxLength: 800, showIf: on('sections.quote') },
      { type: 'text', path: 'invitation.quote.reference', label: 'Reference', maxLength: 120, showIf: on('sections.quote') }
    ]
  },
  {
    id: 'events',
    title: 'Events & venues',
    fields: [
      { type: 'toggle', path: 'sections.events', label: 'Show event pages' },
      { type: 'toggle', path: 'sections.hijri', label: 'Show Hijri dates' },
      {
        type: 'list',
        path: 'invitation.events',
        itemTitle: (item, i) => item.label || `Event ${i + 1}`,
        addLabel: 'Add another event',
        max: 8,
        min: 0,
        newItem: 'event',
        fields: [
          { type: 'toggle', path: 'enabled', label: 'Show this event' },
          { type: 'text', path: 'label', label: 'Event name', maxLength: 80 },
          { type: 'date', path: 'date', label: 'Date (Gregorian)' },
          { type: 'time', path: 'time', label: 'Start time' },
          { type: 'time', path: 'endTime', label: 'End time (optional)' },
          { type: 'toggle', path: 'hijriAuto', label: 'Calculate the Hijri date automatically', hint: 'Uses the Umm al-Qura calendar. Local moon sighting can differ by a day — turn this off to type it yourself.' },
          { type: 'hijri', path: 'hijriDate', label: 'Hijri date', maxLength: 80, placeholder: '7 Ramadan 1448 AH' },
          { type: 'text', path: 'venueName', label: 'Venue name', maxLength: 120 },
          { type: 'textarea', path: 'address', label: 'Venue address', maxLength: 300, rows: 2 },
          { type: 'url', path: 'mapsUrl', label: 'Google Maps link', placeholder: 'https://maps.app.goo.gl/…', hint: 'Leave empty to search the address on Google Maps.' },
          { type: 'text', path: 'note', label: 'Note (optional)', maxLength: 300, placeholder: 'Dinner will be served.' }
        ]
      }
    ]
  },
  {
    id: 'countdown',
    title: 'Countdown',
    fields: [
      { type: 'toggle', path: 'sections.countdown', label: 'Show the countdown page' },
      { type: 'datetime', path: 'invitation.countdown.target', label: 'Count down to', showIf: on('sections.countdown') },
      { type: 'select', path: 'invitation.countdown.utcOffset', label: 'Time zone of the wedding', options: UTC_OFFSETS, showIf: on('sections.countdown'), hint: 'Guests in other countries will see an accurate countdown.' },
      { type: 'action', action: 'countdownFromEvent', label: 'Use the first event’s date and time', showIf: on('sections.countdown') },
      { type: 'text', path: 'invitation.countdown.heading', label: 'Heading', maxLength: 120, showIf: on('sections.countdown') },
      { type: 'text', path: 'invitation.countdown.expiredMessage', label: 'Message after the date has passed', maxLength: 200, showIf: on('sections.countdown') }
    ]
  },
  {
    id: 'media',
    title: 'Photos & artwork',
    fields: [
      { type: 'asset', slot: 'background', label: 'Background artwork', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', hint: 'Optional. Without an upload the original floral artwork is used and follows your colours.' },
      { type: 'toggle', path: 'sections.photo', label: 'Show a photo page' },
      { type: 'asset', slot: 'couplePhoto', label: 'Couple photo', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', showIf: on('sections.photo') },
      { type: 'text', path: 'invitation.gallery.heading', label: 'Photo heading', maxLength: 120, showIf: on('sections.photo') },
      { type: 'text', path: 'invitation.gallery.caption', label: 'Photo caption', maxLength: 200, showIf: on('sections.photo') }
    ]
  },
  {
    id: 'music',
    title: 'Music',
    fields: [
      { type: 'asset', slot: 'music', label: 'Background music', accept: 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,audio/flac,.mp3,.m4a,.ogg,.wav,.flac', hint: 'Only use music you have the right to share. Browsers block automatic playback, so music starts when the guest taps to open (or presses the music button).' },
      { type: 'text', path: 'invitation.music.title', label: 'Track title (optional)', maxLength: 120 },
      { type: 'toggle', path: 'invitation.music.startOnOpen', label: 'Start music when the invitation is opened' },
      { type: 'range', path: 'invitation.music.volume', label: 'Volume', min: 0.1, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` }
    ]
  },
  {
    id: 'rsvp',
    title: 'RSVP',
    fields: [
      { type: 'toggle', path: 'sections.rsvp', label: 'Show the RSVP page' },
      { type: 'text', path: 'invitation.rsvp.heading', label: 'Heading', maxLength: 120, showIf: on('sections.rsvp') },
      { type: 'textarea', path: 'invitation.rsvp.message', label: 'Message', maxLength: 600, rows: 2, showIf: on('sections.rsvp') },
      { type: 'date', path: 'invitation.rsvp.deadline', label: 'Respond by (optional)', showIf: on('sections.rsvp') },
      {
        type: 'list', path: 'invitation.rsvp.contacts', itemTitle: (c, i) => c.name || `Contact ${i + 1}`,
        addLabel: 'Add contact', max: 6, min: 0, newItem: 'contact', showIf: on('sections.rsvp'),
        fields: [
          { type: 'text', path: 'name', label: 'Name', maxLength: 80 },
          { type: 'tel', path: 'phone', label: 'Phone number', maxLength: 40, placeholder: '+91 98765 43210' }
        ]
      },
      { type: 'tel', path: 'invitation.rsvp.whatsapp', label: 'WhatsApp number (optional)', maxLength: 40, placeholder: '+91 98765 43210', hint: 'Include the country code.', showIf: on('sections.rsvp') },
      { type: 'text', path: 'invitation.rsvp.whatsappMessage', label: 'Pre-filled WhatsApp message', maxLength: 300, showIf: on('sections.rsvp') },
      { type: 'url', path: 'invitation.rsvp.link', label: 'RSVP form link (optional)', placeholder: 'https://forms.gle/…', hint: 'For example a Google Form. Only https links are used.', showIf: on('sections.rsvp') }
    ]
  },
  {
    id: 'closing',
    title: 'Final page',
    fields: [
      { type: 'text', path: 'invitation.closing.heading', label: 'Heading', maxLength: 120 },
      { type: 'textarea', path: 'invitation.closing.message', label: 'Message', maxLength: 800 },
      { type: 'text', path: 'invitation.closing.signature', label: 'Signed by', maxLength: 200 },
      { type: 'text', path: 'invitation.closing.hashtag', label: 'Hashtag (optional)', maxLength: 80 }
    ]
  },
  {
    id: 'animation',
    title: 'Animation',
    fields: [
      { type: 'select', path: 'animation.pageTurn', label: 'Page transition (book template)', options: [
        { value: 'flip', label: '3D page turn' }, { value: 'slide', label: 'Slide' }, { value: 'fade', label: 'Fade' }] },
      { type: 'range', path: 'animation.pageTurnMs', label: 'Transition speed', min: 400, max: 1800, step: 50, format: (v) => `${(v / 1000).toFixed(2)} s` },
      { type: 'toggle', path: 'animation.petals', label: 'Falling petals' },
      { type: 'select', path: 'animation.reducedMotion', label: 'Reduced motion', options: [
        { value: 'auto', label: 'Follow the guest’s device setting' },
        { value: 'reduce', label: 'Always use gentle fades' },
        { value: 'full', label: 'Always animate' }] }
    ]
  },
  {
    id: 'site',
    title: 'Language & sharing',
    fields: [
      { type: 'text', path: 'meta.title', label: 'Browser tab / link preview title', maxLength: 140, placeholder: 'Automatic: “Ayesha & Zayan — Wedding Invitation”' },
      { type: 'textarea', path: 'meta.description', label: 'Link preview description', maxLength: 300, rows: 2 },
      { type: 'select', path: 'meta.lang', label: 'Date language', options: [
        { value: 'en', label: 'English' }, { value: 'en-GB', label: 'English (UK)' }, { value: 'en-IN', label: 'English (India)' },
        { value: 'ur', label: 'Urdu' }, { value: 'ar', label: 'Arabic' }, { value: 'hi', label: 'Hindi' }, { value: 'fr', label: 'French' },
        { value: 'tr', label: 'Turkish' }, { value: 'ms', label: 'Malay' }, { value: 'id', label: 'Indonesian' }] },
      { type: 'select', path: 'meta.dir', label: 'Text direction', options: [{ value: 'ltr', label: 'Left to right' }, { value: 'rtl', label: 'Right to left' }] },
      {
        type: 'group', label: 'Button and label text', className: 'labels', fields: [
          { type: 'text', path: 'invitation.labels.days', label: 'Days', placeholder: 'Days', maxLength: 30 },
          { type: 'text', path: 'invitation.labels.hours', label: 'Hours', placeholder: 'Hours', maxLength: 30 },
          { type: 'text', path: 'invitation.labels.minutes', label: 'Minutes', placeholder: 'Minutes', maxLength: 30 },
          { type: 'text', path: 'invitation.labels.seconds', label: 'Seconds', placeholder: 'Seconds', maxLength: 30 },
          { type: 'text', path: 'invitation.labels.venue', label: 'Venue', placeholder: 'Venue', maxLength: 30 },
          { type: 'text', path: 'invitation.labels.viewMap', label: 'Map button', placeholder: 'View location', maxLength: 30 },
          { type: 'text', path: 'invitation.labels.rsvpBy', label: 'RSVP deadline', placeholder: 'Kindly respond by', maxLength: 40 },
          { type: 'text', path: 'invitation.labels.readAgain', label: 'Read again', placeholder: 'Read again', maxLength: 30 }
        ]
      }
    ]
  }
];
