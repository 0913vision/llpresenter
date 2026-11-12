import {describe, expect, it} from 'vitest';
import {
  parsePowerPointBackgroundRequest,
  parsePowerPointReadResult,
  parsePowerPointReleaseRequest,
  parsePowerPointMatchResult,
} from '@core/schema/powerpointImport';

describe('PowerPoint import IPC', () => {
  it('accepts a valid retained deck and selection', () => {
    expect(
      parsePowerPointReadResult({
        ok: true,
        value: {
          fileName: 'a.pptx',
          slides: [
            {
              number: 1,
              shapes: [{body: true, lines: ['test']}],
              background: null,
            },
          ],
        },
      }).ok,
    ).toBe(true);
    expect(parsePowerPointBackgroundRequest({index: 0}).ok).toBe(true);
    const release = parsePowerPointReleaseRequest({path: 'C:/temp/image.png'});
    expect(release.ok).toBe(true);
    expect(parsePowerPointMatchResult(null).ok).toBe(true);
    expect(
      parsePowerPointMatchResult('00000000-0000-4000-8000-000000000123').ok,
    ).toBe(true);
  });
  it('rejects invalid slide numbers and background selections', () => {
    expect(
      parsePowerPointReadResult({
        ok: true,
        value: {
          fileName: 'a.pptx',
          slides: [{number: 0, shapes: [], background: null}],
        },
      }).ok,
    ).toBe(false);
    expect(parsePowerPointBackgroundRequest({index: -1}).ok).toBe(false);
    expect(parsePowerPointBackgroundRequest({index: 1.5}).ok).toBe(false);
    expect(parsePowerPointReleaseRequest({path: ''}).ok).toBe(false);
    expect(parsePowerPointReleaseRequest({path: 3}).ok).toBe(false);
    expect(parsePowerPointMatchResult('not-a-media-id').ok).toBe(false);
  });
});
