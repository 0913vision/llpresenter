import {describe, expect, it} from 'vitest';
import {durationText, mediaEntries, sizeText, totalText} from './mediaEntries';
import {mediaDocument, mediaId, mediaItem} from './mediaTesting';

describe('media grid entries', () => {
  it('lists every item, then the files not in the list yet', () => {
    const copying = {
      mediaId: mediaId(2),
      fileName: 'Invented 2.mp4',
      phase: 'analysing',
      percent: 100,
    } as const;
    const fresh = {
      mediaId: mediaId(9),
      fileName: 'New.mp4',
      phase: 'copying',
      percent: 40,
    } as const;
    expect(
      mediaEntries(mediaDocument([mediaItem(1), mediaItem(2)]), [
        copying,
        fresh,
      ]).map(entry =>
        entry.kind === 'media'
          ? [entry.kind, entry.id, entry.copying]
          : [entry.kind, entry.id, entry.job.percent],
      ),
    ).toEqual([
      ['media', mediaId(1), undefined],
      ['media', mediaId(2), 100],
      ['copy', mediaId(9), 40],
    ]);
    expect(mediaEntries(null, [])).toEqual([]);
  });

  it('writes durations, sizes, and the footer total', () => {
    expect(durationText(undefined)).toBeUndefined();
    expect(durationText(30.9)).toBe('0:30');
    expect(durationText(725)).toBe('12:05');
    expect(sizeText(512)).toBe('512B');
    expect(sizeText(1536)).toBe('1.5KB');
    expect(sizeText(2.1 * 1024 ** 3)).toBe('2.1GB');
    expect(
      totalText([mediaItem(1, {size: 1024}), mediaItem(2, {size: 512})]),
    ).toBe('2개 1.5KB');
  });
});
