import {describe, expect, it} from 'vitest';
import {importedProps} from '@core/media/importedProps';
import {defaultPreferences} from '@core/schema/preferences';

const DEFAULTS = defaultPreferences.media.defaults;

describe('importedProps', () => {
  it('keeps the props of a video as before with the defaults, and an image and an audio file without any', () => {
    expect(importedProps('video', DEFAULTS)).toEqual({audio: false});
    expect(importedProps('image', DEFAULTS)).toBeUndefined();
    expect(importedProps('audio', DEFAULTS)).toBeUndefined();
  });

  it('writes 끝나면, 맞춤, and sound of a video only when they differ from what a media without them does', () => {
    expect(
      importedProps('video', {end: 'stop', fit: 'stretch', audio: true}),
    ).toEqual({audio: true, end: 'stop', fit: 'stretch'});
    expect(importedProps('video', {...DEFAULTS, fit: 'fit'})).toEqual({
      audio: false,
      fit: 'fit',
    });
  });

  it('gives an image only 맞춤 and an audio file nothing', () => {
    const changed = {end: 'stop', fit: 'stretch', audio: true} as const;
    expect(importedProps('image', changed)).toEqual({fit: 'stretch'});
    expect(importedProps('audio', changed)).toBeUndefined();
  });
});
