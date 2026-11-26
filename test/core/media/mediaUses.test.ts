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
import {lyricsSlide} from '@fixtures/core/slides';
import {parseSong} from '@core/schema/songs/song';
import {parseService} from '@core/schema/services/service';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}
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

describe('the places in songs, 예배 and settings that use a media item', () => {
  const background = {kind: 'media' as const, media: target};

  it('counts songs and 예배 items that show it, 예배 overlays, themes and macros', () => {
    const song = parseSong(
      JSON.stringify({
        format: 'llsong',
        schemaVersion: 1,
        id: uuid(200),
        title: '만복의 근원 하나님',
        slides: [lyricsSlide(1, '만복의 근원', {background})],
      }),
      'song.llsong',
    );
    const sunday = parseService(
      JSON.stringify({
        format: 'llservice',
        schemaVersion: 1,
        id: uuid(400),
        name: '주일 예배',
        date: '2026-11-29T11:00',
        order: [
          {
            id: uuid(401),
            kind: 'media',
            name: '배경 영상',
            media: target,
            slides: [lyricsSlide(1, '')],
          },
          {
            id: uuid(402),
            kind: 'blank',
            name: '빈 슬라이드',
            slides: [lyricsSlide(1, '', {background})],
          },
        ],
      }),
      'sunday.llservice',
    );
    if (!song.ok || !sunday.ok) throw new Error('Invalid fixture');
    const [theme] = sampleThemes().themes;
    if (theme === undefined) throw new Error('No theme');
    const macros = settingsDocument('macros', {
      macros: [
        {
          id: uuid(300),
          name: '영상',
          icon: 'play',
          color: 'teal',
          actions: [{kind: 'media', media: target}],
        },
      ],
      collections: [],
    });
    if (macros.name !== 'macros') throw new Error('Missing macros');
    const uses = countMediaUses(
      target,
      sources({
        songs: [song.value.data],
        services: [sunday.value.data],
        themes: {
          ...sampleThemes(),
          themes: [{...theme, background}],
        },
        macros: macros.value,
      }),
    );
    expect(uses).toMatchObject({
      songBackgrounds: 1,
      serviceItems: 2,
      themes: 1,
      macros: 1,
    });
  });
});
