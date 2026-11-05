import {describe, expect, it} from 'vitest';
import {countMediaUses, type MediaUseSources} from '@core/media/mediaUses';
import {createMediaId, createThemeElementId} from '@core/schema/ids';
import {parseService} from '@core/schema/service';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {parseMediaUses, parseMediaUsesRequest} from '@core/schema/mediaUses';
import {createDefaultThemes} from '@core/themes/defaults';
import {newThemeElement} from '@core/themes/newElement';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {song} from '@fixtures/core/songs/blockFixtures';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
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

function service(items: readonly object[]) {
  return expectSuccess(
    parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: uuid(500),
        name: '주일',
        date: '2026-11-01T11:00',
        order: items,
      }),
      'service.llservice',
    ),
  ).data;
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
  const themes = createDefaultThemes();
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

  it('counts song backgrounds, an item background, a media item, and an item overlay', () => {
    const withBackground = {...song(), background: target};
    const free = song();
    const services = [
      service([
        {id: uuid(1), song: free.id, background: target},
        {id: uuid(2), song: free.id},
        {id: uuid(3), media: target},
        {id: uuid(4), media: other},
        {
          id: uuid(5),
          media: other,
          overlays: [
            {
              id: uuid(6),
              name: '오버레이',
              from: 1,
              to: 1,
              screens: [],
              content: {media: target, loop: false, sound: false},
            },
            {
              id: uuid(7),
              name: '글자',
              from: 2,
              to: 2,
              screens: [],
              content: {text: 'x'},
            },
          ],
        },
      ]),
    ];
    expect(
      countMediaUses(
        target,
        sources({songs: [withBackground, free], services}),
      ),
    ).toMatchObject({songBackgrounds: 1, serviceItems: 2, itemOverlays: 1});
  });

  it('counts a theme once for any image element, and a macro for a media or audio action', () => {
    const themes = createDefaultThemes();
    const first = themes.themes[0];
    if (first === undefined) throw new Error('No theme');
    const [layoutKey, layout] = Object.entries(first.screens)[0] ?? [];
    const image = newThemeElement({
      id: createThemeElementId(uuid(300)),
      kind: 'image',
      mediaId: target,
    });
    if (
      layoutKey === undefined ||
      layout === undefined ||
      image === undefined
    ) {
      throw new Error('No layout');
    }
    const used = {
      ...themes,
      themes: [
        {
          ...first,
          screens: {
            ...first.screens,
            [layoutKey]: {...layout, elements: [...layout.elements, image]},
          },
        },
        ...themes.themes.slice(1),
      ],
    };
    const macros = settingsDocument('macros', {
      macros: [
        {
          id: uuid(400),
          name: 'a',
          icon: 'play',
          color: 'teal',
          actions: [
            {kind: 'media', media: target},
            {kind: 'audio', operation: 'play', media: target},
          ],
        },
        {
          id: uuid(401),
          name: 'b',
          icon: 'play',
          color: 'teal',
          actions: [{kind: 'media', media: other}],
        },
      ],
      collections: [],
    });
    if (macros.name !== 'macros') throw new Error('Missing macros');
    expect(
      countMediaUses(target, sources({themes: used, macros: macros.value})),
    ).toMatchObject({themes: 1, macros: 1});
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
