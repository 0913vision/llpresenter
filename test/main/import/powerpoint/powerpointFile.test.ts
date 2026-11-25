import {describe, expect, it, vi} from 'vitest';
import {
  isLegacyPowerPoint,
  PowerPointError,
  powerPointMessage,
  unsupportedSlideSize,
} from '@main/import/powerpoint/powerpointFile';

vi.mock('electron', () => ({dialog: {}}));

describe('isLegacyPowerPoint', () => {
  it('needs PowerPoint to convert only an old .ppt file, in any case', () => {
    expect(isLegacyPowerPoint('C:/찬양/주일.ppt')).toBe(true);
    expect(isLegacyPowerPoint('C:/찬양/주일.PPT')).toBe(true);
    expect(isLegacyPowerPoint('C:/찬양/주일.pptx')).toBe(false);
    expect(isLegacyPowerPoint('C:/찬양/주일.pptm')).toBe(false);
  });
});

describe('powerPointMessage', () => {
  it('says what went wrong with PowerPoint, and the caller’s text for anything else', () => {
    const fallback = '파일을 읽을 수 없습니다.';
    expect(
      powerPointMessage(
        new PowerPointError('convert', 'unavailable'),
        fallback,
      ),
    ).toBe('이 파일을 가져오려면 PowerPoint가 설치되어 있어야 합니다.');
    expect(
      powerPointMessage(new PowerPointError('export', 'unavailable'), fallback),
    ).toBe('PowerPoint가 설치되어 있지 않습니다.');
    expect(
      powerPointMessage(
        new PowerPointError('export', 'unresponsive'),
        fallback,
      ),
    ).toBe('PowerPoint가 응답하지 않습니다.');
    expect(
      powerPointMessage(new PowerPointError('convert', 'file'), fallback),
    ).toBe('PowerPoint 파일을 변환할 수 없습니다.');
    expect(
      powerPointMessage(new PowerPointError('export', 'file'), fallback),
    ).toBe(fallback);
    expect(powerPointMessage(new Error('Invented'), fallback)).toBe(fallback);
  });
});

describe('unsupportedSlideSize', () => {
  it('takes wide slides and other shapes, and refuses 4:3 slides with the way out', () => {
    expect(unsupportedSlideSize({widescreen: true})).toBeNull();
    expect(
      unsupportedSlideSize({widescreen: false, width: 960, height: 600}),
    ).toBeNull();
    expect(
      unsupportedSlideSize({widescreen: false, width: 960, height: 720}),
    ).toBe('4:3 파일은 가져올 수 없습니다. PowerPoint에서 16:9로 바꾸세요.');
  });

  it('throws on a reply that is not a slide size', () => {
    expect(() => unsupportedSlideSize(null)).toThrow();
    expect(() => unsupportedSlideSize({widescreen: false, width: 0})).toThrow();
    expect(() =>
      unsupportedSlideSize({widescreen: false, width: 960, height: -1}),
    ).toThrow();
  });
});
