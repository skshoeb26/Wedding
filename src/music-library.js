// Built-in background tones. All are original compositions synthesised by
// tools/generate-tones.mjs, so they can be bundled with any invitation.

export const MUSIC_LIBRARY = [
  {
    id: 'ajam-joy',
    title: 'Joyful Ajam',
    description: 'Bright, happy qanun melody with daf and claps.',
    instruments: 'Qanun · Oud · Daf',
    percussion: true
  },
  {
    id: 'wedding-zaffa',
    title: 'Wedding Zaffa',
    description: 'A festive procession tune for the couple’s grand entrance.',
    instruments: 'Qanun · Oud · Daf',
    percussion: true
  },
  {
    id: 'sweet-nikah',
    title: 'Sweet Nikah',
    description: 'Gentle and cheerful music-box melody. No drums.',
    instruments: 'Bells · Qanun',
    percussion: false
  },
  {
    id: 'garden-dabke',
    title: 'Garden Dabke',
    description: 'Lively, dancing oud tune with a dabke rhythm.',
    instruments: 'Oud · Qanun · Daf',
    percussion: true
  },
  {
    id: 'rast-celebration',
    title: 'Rast Celebration',
    description: 'Classic festive Arabic sound in maqam Rast.',
    instruments: 'Qanun · Oud · Daf',
    percussion: true
  },
  {
    id: 'daf-zaffa',
    title: 'Daf & Claps',
    description: 'Upbeat daf rhythm and hand claps only. No melodic instruments.',
    instruments: 'Daf · Claps',
    percussion: true
  }
];

export const LIBRARY_IDS = MUSIC_LIBRARY.map((t) => t.id);

export function libraryTrack(id) {
  return MUSIC_LIBRARY.find((t) => t.id === id) || null;
}

export function libraryPath(id) {
  return `audio/library/${id}.mp3`;
}

export function libraryAssetId(id) {
  return `library-${id}`;
}
