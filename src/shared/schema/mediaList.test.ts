import {describe, expectTypeOf, it} from 'vitest';
import type {MediaId} from './ids';
import {
  parseMediaList,
  serializeMediaList,
  type MediaItem,
  type MediaPlaylist,
} from './mediaList';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseMediaList, serialize: serializeMediaList};
const WARM_LIGHT = '3b9d0c52-7e1f-4a2b-8c3d-4e5f60718293';
const LOGO = '8a8b8c8d-1e2f-4a3b-9c4d-5e6f7a8b9c0d';
const PRELUDE = '9a9b9c9d-2e3f-4a4b-8c5d-6e7f8a9b0c1d';

function warmLight() {
  return {
    id: WARM_LIGHT,
    name: '따뜻한 빛',
    kind: 'video',
    file: '배경/따뜻한 빛.mp4',
    size: 2254857830,
    duration: 62.5,
    width: 1920,
    height: 1080,
    props: {
      end: 'loop',
      in: 0,
      out: 60,
      speed: 1,
      fit: 'fill',
      audio: false,
      volume: 80,
    },
  };
}

function mediaList() {
  return {
    format: 'llmedia',
    schemaVersion: 1,
    items: [
      warmLight(),
      {
        id: LOGO,
        name: '로고',
        kind: 'image',
        file: 'D:\\교회\\로고.png',
        size: 48211,
        width: 1920,
        height: 1080,
      },
      {
        id: PRELUDE,
        name: '예배 전 음악',
        kind: 'audio',
        file: '음악/전주.mp3',
        size: 5120000,
        duration: 245,
      },
    ],
    playlists: [
      {
        id: 'b1b2b3b4-1111-4222-8333-444455556666',
        name: '배경 영상',
        items: [WARM_LIGHT],
      },
    ],
    audioPlaylists: [
      {
        id: 'c1c2c3c4-1111-4222-8333-444455556666',
        name: '예배 전 음악',
        items: [PRELUDE],
        loop: true,
      },
    ],
  };
}

function withItem(item: object) {
  return {...mediaList(), items: [item]};
}

describe('parseMediaList', () => {
  it('reads media of every kind and both playlist kinds', () => {
    expectRoundTrip(codec, mediaList());
  });

  it('reads an empty media list', () => {
    expectRoundTrip(codec, {
      ...mediaList(),
      items: [],
      playlists: [],
      audioPlaylists: [],
    });
  });

  it('keeps unknown fields in items and their properties', () => {
    const item = warmLight();
    expectRoundTrip(
      codec,
      withItem({...item, codec: 'h264', props: {...item.props, fadeIn: 2}}),
    );
  });

  it.each([
    ['an unknown kind', {kind: 'input'}, 'items.0.kind'],
    ['an empty file path', {file: ''}, 'items.0.file'],
    ['a fractional size', {size: 1.5}, 'items.0.size'],
    ['a negative duration', {duration: -1}, 'items.0.duration'],
    ['a volume over 100', {props: {volume: 120}}, 'items.0.props.volume'],
    ['speed zero', {props: {speed: 0}}, 'items.0.props.speed'],
    ['an unknown fit', {props: {fit: 'crop'}}, 'items.0.props.fit'],
  ])('rejects an item with %s', (_name, change, field) => {
    expectInvalidField(codec, withItem({...warmLight(), ...change}), field);
  });

  it('rejects a playlist that holds a path instead of a media id', () => {
    const list = mediaList();
    const [playlist] = list.playlists;

    expectInvalidField(
      codec,
      {...list, playlists: [{...playlist, items: ['배경/따뜻한 빛.mp4']}]},
      'playlists.0.items.0',
    );
  });
});

describe('media list types', () => {
  it('brands media ids', () => {
    expectTypeOf<MediaItem['id']>().toEqualTypeOf<MediaId>();
    expectTypeOf<MediaPlaylist['items']>().toEqualTypeOf<readonly MediaId[]>();
  });
});
