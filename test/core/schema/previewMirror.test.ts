import {describe, expect, it} from 'vitest';
import {
  parsePreviewRequest,
  parsePreviewSource,
  parsePreviewControl,
  parsePreviewFrame,
} from '@core/schema/previewMirror';

describe('preview source token', () => {
  it('accepts only a bounded web contents capture identifier or no source', () => {
    expect(parsePreviewSource('z8VER1ATiWQgPdUIVkt9fg==').ok).toBe(true);
    expect(parsePreviewSource(null).ok).toBe(true);
    expect(parsePreviewSource('alpha').ok).toBe(true);
    expect(parsePreviewSource('relay').ok).toBe(true);
    expect(parsePreviewSource('desktop:window:123:0').ok).toBe(true);
    expect(parsePreviewSource('desktop:screen:0:0').ok).toBe(false);
    expect(parsePreviewSource('screen:0:0').ok).toBe(false);
    expect(parsePreviewSource('web-contents-media-stream://1:2/extra').ok).toBe(
      false,
    );
    expect(
      parsePreviewSource(`web-contents-media-stream://${'1'.repeat(130)}:1`).ok,
    ).toBe(false);
  });
  it('bounds the requested screen identifier', () => {
    expect(parsePreviewRequest({screenId: 'main'}).ok).toBe(true);
    expect(parsePreviewRequest({screenId: ''}).ok).toBe(false);
    expect(parsePreviewRequest({screenId: 'x'.repeat(101)}).ok).toBe(false);
  });
  it('accepts only bounded native preview frames and valid control actions', () => {
    expect(
      parsePreviewFrame({
        screenId: 'main',
        frame: new Uint8Array(640 * 360 * 4),
      }).ok,
    ).toBe(true);
    expect(parsePreviewFrame({screenId: 'main', frame: null}).ok).toBe(true);
    expect(
      parsePreviewFrame({screenId: 'main', frame: new Uint8Array(1)}).ok,
    ).toBe(false);
    expect(parsePreviewControl({screenId: 'main', action: 'ack'}).ok).toBe(
      true,
    );
    expect(parsePreviewControl({screenId: 'main', action: 'other'}).ok).toBe(
      false,
    );
  });
});
