import {describe, expect, it} from 'vitest';
import {fixtureMedia} from '@fixtures/core/mediaList';
import {
  hasMediaDrag,
  MEDIA_DRAG_MIME,
  type MediaDragData,
  readMediaDrag,
  writeMediaDrag,
} from '@renderer/features/media/mediaDrag';

function transfer(data: Record<string, string>): MediaDragData {
  return {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    effectAllowed: 'none',
  };
}

describe('media drag', () => {
  it('carries a media file by its id', () => {
    const data: Record<string, string> = {};
    const out = transfer(data);
    writeMediaDrag(out, fixtureMedia.dawn);
    expect(data[MEDIA_DRAG_MIME]).toBe(fixtureMedia.dawn);
    expect(out.effectAllowed).toBe('copy');
  });

  it('reads back only a valid media id', () => {
    const ok = transfer({[MEDIA_DRAG_MIME]: fixtureMedia.dawn});
    expect(hasMediaDrag(ok)).toBe(true);
    expect(readMediaDrag(ok)).toBe(fixtureMedia.dawn);
    const bad = transfer({[MEDIA_DRAG_MIME]: 'not an id'});
    expect(readMediaDrag(bad)).toBeUndefined();
    expect(hasMediaDrag(transfer({}))).toBe(false);
  });
});
