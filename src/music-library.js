// Built-in background tones. All are original compositions synthesised by
// tools/generate-tones.mjs, so they can be bundled with any invitation.

export const MUSIC_LIBRARY = [
  {
    id: 'hijaz-dawn',
    title: 'Hijaz Dawn',
    description: 'Ney flute over soft qanun, in maqam Hijaz. Calm and classic.',
    instruments: 'Ney · Qanun',
    percussion: false
  },
  {
    id: 'bayati-serenity',
    title: 'Bayati Serenity',
    description: 'A slow, peaceful ney melody in maqam Bayati.',
    instruments: 'Ney · Oud',
    percussion: false
  },
  {
    id: 'kurd-blessing',
    title: 'Kurd Blessing',
    description: 'Warm oud answered by qanun, in maqam Kurd.',
    instruments: 'Oud · Qanun',
    percussion: false
  },
  {
    id: 'nahawand-evening',
    title: 'Nahawand Evening',
    description: 'Romantic oud and qanun with a gentle daf, in maqam Nahawand.',
    instruments: 'Oud · Qanun · Daf',
    percussion: true
  },
  {
    id: 'rast-celebration',
    title: 'Rast Celebration',
    description: 'Joyful qanun and oud with a festive daf rhythm, in maqam Rast.',
    instruments: 'Qanun · Oud · Daf',
    percussion: true
  },
  {
    id: 'daf-zaffa',
    title: 'Daf Zaffa',
    description: 'Wedding rhythm on the daf with hand claps only. No melodic instruments.',
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
