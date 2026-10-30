import {describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {recentWriter} from './recentWriter';
import {
  bibleDocument,
  panelApi,
  panelPassage,
} from '../features/bible/panelTesting';

describe('recent Bible writes', () => {
  it('serializes output history, keeps the newest ten, and preserves unknown fields', async () => {
    const fixture = panelApi();
    let finish: (value: SettingsDocument) => void = () => undefined;
    fixture.get.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const remember = recentWriter(fixture.api.settings);
    for (let verse = 1; verse <= 15; verse++) {
      remember({...panelPassage(), ref: `요한복음 3:${verse}`});
    }
    expect(fixture.get).toHaveBeenCalledTimes(1);
    finish(bibleDocument());
    await vi.waitFor(() =>
      expect(fixture.document().value.recents).toHaveLength(10),
    );
    expect(fixture.document().value.recents.map(item => item.ref)).toEqual(
      Array.from({length: 10}, (_, index) => `요한복음 3:${15 - index}`),
    );
    expect(fixture.edit).toHaveBeenCalledTimes(2);
    expect(fixture.document().value).toMatchObject({extension: {kept: true}});
    remember({...panelPassage(), ref: '요한복음 3:10'});
    await vi.waitFor(() =>
      expect(fixture.document().value.recents[0]?.ref).toBe('요한복음 3:10'),
    );
    expect(fixture.document().value.recents).toHaveLength(10);
  });

  it('re-reads stale settings and recovers after a failed save without throwing into output', async () => {
    const fixture = panelApi();
    fixture.edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Invented revision race'},
    });
    const remember = recentWriter(fixture.api.settings);
    remember(panelPassage());
    await vi.waitFor(() => expect(fixture.edit).toHaveBeenCalledTimes(2));
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    fixture.get.mockRejectedValueOnce(new Error('Invented read failure'));
    remember({...panelPassage(), ref: '창세기 1:1'});
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    remember({...panelPassage(), ref: '창세기 1:2'});
    await vi.waitFor(() =>
      expect(fixture.document().value.recents[0]?.ref).toBe('창세기 1:2'),
    );
  });
});
