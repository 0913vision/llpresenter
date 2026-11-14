import {DOMParser} from '@xmldom/xmldom';
import {describe, expect, it} from 'vitest';
import {powerpointTextFormat} from '@main/import/powerpointTextFormat';
import {checkPart} from '@core/schema/fileFormat';
import {songLyricFormatSchema} from '@core/schema/songLyricFormat';
import {powerpointSlides} from '@core/songs/powerpointSlides';
import {importSlides} from '@core/songs/importSlides';

const ns = 'xmlns:p="urn:p" xmlns:a="urn:a"';
const element = (value: string): Element =>
  new DOMParser().parseFromString(value, 'application/xml').documentElement;

describe('PowerPoint lyric typography', () => {
  it('resolves per-run and paragraph properties and converts points to reference pixels', () => {
    const shape = element(
      `<p:sp ${ns}><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:ext cx="10160000" cy="100"/></a:xfrm></p:spPr><p:txBody><a:p><a:pPr><a:lnSpc><a:spcPct val="125000"/></a:lnSpc></a:pPr><a:r><a:rPr sz="4400" spc="-300"><a:ea typeface="Font A"/></a:rPr><a:t>First </a:t></a:r><a:r><a:rPr sz="6000"/><a:t>second</a:t></a:r></a:p><a:p><a:pPr><a:lnSpc><a:spcPts val="3000"/></a:lnSpc></a:pPr><a:r><a:t>Third</a:t></a:r></a:p></p:txBody></p:sp>`,
    );
    const layout = element(
      `<p:sldLayout ${ns}><p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:lstStyle><a:lvl1pPr><a:defRPr sz="5000" spc="-200"/></a:lvl1pPr></a:lstStyle></p:txBody></p:sp></p:sldLayout>`,
    );
    const result = powerpointTextFormat(
      shape,
      {layout, master: undefined, theme: undefined},
      12192000,
    );
    expect(result).toEqual({
      lines: [
        {
          boxWidth: 1600,
          spacing: {kind: 'ratio', value: 1.25},
          runs: [
            {text: 'First ', size: 88, tracking: -6, font: 'Font A'},
            {text: 'second', size: 120, tracking: -4},
          ],
        },
        {
          boxWidth: 1600,
          spacing: {kind: 'pixels', value: 60},
          runs: [{text: 'Third', size: 100, tracking: -4}],
        },
      ],
    });
  });
  it('retains imported paragraph and run formatting when creating song slides', () => {
    const lyricFormat = {
      lines: [
        {
          boxWidth: 1600,
          runs: [
            {text: 'First ', size: 66, tracking: -4.5},
            {text: 'second', size: 90},
          ],
        },
      ],
    };
    const imported = powerpointSlides([
      {
        number: 1,
        background: null,
        shapes: [{body: true, lines: ['First second'], lyricFormat}],
      },
    ]);
    expect(imported).toEqual([{lines: ['First second'], lyricFormat}]);
    expect(
      importSlides(imported, () => '00000000-0000-4000-8000-000000000001')[0],
    ).toMatchObject({lines: ['First second'], lyricFormat});
  });

  it('preserves all paragraphs in one title box and each of two title boxes', () => {
    const line = (text: string, left: number, top: number) => ({
      boxWidth: 1000,
      left,
      top,
      runs: [{text, size: 80}],
    });
    const one = {
      number: 1,
      background: null,
      shapes: [
        {
          body: false,
          lines: ['First', 'Second', 'Third'],
          lyricFormat: {
            lines: [
              line('First', 200, 100),
              line('Second', 200, 200),
              line('Third', 200, 300),
            ],
          },
        },
      ],
    };
    const two = {
      number: 1,
      background: null,
      shapes: [
        {
          body: false,
          lines: ['Title'],
          lyricFormat: {lines: [line('Title', 100, 120)]},
        },
        {
          body: false,
          lines: ['Subtitle'],
          lyricFormat: {lines: [line('Subtitle', 300, 400)]},
        },
      ],
    };
    const first = powerpointSlides([one])[0];
    expect(first).toMatchObject({
      titleSlide: true,
      lines: ['First', 'Second', 'Third'],
      lyricFormat: one.shapes[0]?.lyricFormat,
    });
    const second = powerpointSlides([two])[0];
    expect(second).toMatchObject({
      titleSlide: true,
      lines: ['Title', 'Subtitle'],
      lyricFormat: {
        lines: [line('Title', 100, 120), line('Subtitle', 300, 400)],
      },
    });
  });

  it('rejects invalid or unbounded format data', () => {
    const line = {boxWidth: 1600, runs: [{text: 'hello', size: 108}]};
    expect(checkPart(songLyricFormatSchema, {lines: [line]}).ok).toBe(true);
    for (const invalid of [
      {lines: []},
      {lines: [{...line, boxWidth: Infinity}]},
      {lines: [{...line, runs: [{text: 'x', size: -1}]}]},
      {lines: [{...line, runs: Array(257).fill({text: 'x'})}]},
    ]) {
      expect(checkPart(songLyricFormatSchema, invalid).ok).toBe(false);
    }
  });
});
