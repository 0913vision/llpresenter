import {createMediaId} from '../schema/ids';
import {parseMediaDocument} from '../schema/mediaEdit';

/** Three invented media ids: two pictures and an audio file. */
export const fixtureMedia = {
  warm: createMediaId('60000000-0000-4000-8000-000000000011'),
  dawn: createMediaId('60000000-0000-4000-8000-000000000012'),
  hymn: createMediaId('60000000-0000-4000-8000-000000000013'),
} as const;

/** Two pictures and one audio file, as the media list holds them. */
export function itemMedia() {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: [
        {
          id: fixtureMedia.warm,
          name: '따뜻한 빛',
          kind: 'image',
          file: 'a.png',
          size: 0,
        },
        {
          id: fixtureMedia.dawn,
          name: '새벽 하늘',
          kind: 'video',
          file: 'b.mp4',
          size: 0,
        },
        {
          id: fixtureMedia.hymn,
          name: '찬송 반주',
          kind: 'audio',
          file: 'c.mp3',
          size: 0,
        },
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
}
