import {describe, expect, it} from 'vitest';
import {countMediaUses, type MediaUseSources} from '@core/media/mediaUses';
import {createMediaId} from '@core/schema/common/ids';
import {parseMediaDocument} from '@core/schema/media/mediaEdit';
import {
  parseMediaUses,
  parseMediaUsesRequest,
} from '@core/schema/media/mediaUses';
import {themes as sampleThemes} from '@fixtures/core/themeOutput';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {IMAGES, overlaySettings} from '@fixtures/core/overlays';

const uuid = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const target = IMAGES[0];
const other = IMAGES[1];
if (target === undefined || other === undefined) throw new Error('No ids');

function fixtureProps(): MediaUseSources['props'] {
  const value = overlaySettings().reader.get('props');
  if (value.name !== 'props') throw new Error('Missing props');
  return value.value;
}

function mediaList(): MediaUseSources['media'] {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: [],
      playlists: [
        {id: uuid(900), name: 'A', items: [target]},
        {id: uuid(901), name: 'B', items: [other]},
      ],
      audioPlaylists: [
        {id: uuid(950), name: 'C', items: [target], loop: false},
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value.value;
}

function sources(change: Partial<MediaUseSources> = {}): MediaUseSources {
  const themes = sampleThemes();
  const macros = settingsDocument('macros', {macros: [], collections: []});
  if (macros.name !== 'macros') throw new Error('Missing macros');
  return {
    media: mediaList(),
    props: fixtureProps(),
    themes,
    macros: macros.value,
    songs: [],
    services: [],
    ...change,
  };
}

describe('the places that use a media item', () => {
  it('counts playlists and 그래픽 that hold it', () => {
    const uses = countMediaUses(target, sources());
    expect(uses).toMatchObject({
      playlists: 2,
      graphics: 1,
    });
    expect(countMediaUses(createMediaId(uuid(777)), sources())).toEqual({
      playlists: 0,
      graphics: 0,
      songBackgrounds: 0,
      serviceItems: 0,
      itemOverlays: 0,
      themes: 0,
      macros: 0,
    });
  });
});

describe('the media:uses payloads', () => {
  it('accepts a request with a media id and a reply with counts', () => {
    expect(parseMediaUsesRequest({mediaId: uuid(1)}).ok).toBe(true);
    expect(
      parseMediaUses({
        playlists: 0,
        graphics: 2,
        songBackgrounds: 3,
        serviceItems: 4,
        itemOverlays: 5,
        themes: 6,
        macros: 7,
      }).ok,
    ).toBe(true);
  });

  it.each([{}, {mediaId: 'bad'}, {mediaId: 7}])(
    'rejects the request %j',
    value => {
      expect(parseMediaUsesRequest(value).ok).toBe(false);
    },
  );

  it.each([{playlists: -1}, {playlists: 0.5}, {playlists: 'x'}, {}])(
    'rejects the reply %j',
    value => {
      expect(parseMediaUses(value).ok).toBe(false);
    },
  );
});
