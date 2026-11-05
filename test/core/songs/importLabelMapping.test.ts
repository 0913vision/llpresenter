import {describe, expect, it} from 'vitest';
import type {Label} from '@core/schema/labels';
import {
  applyImportLabelMapping,
  suggestImportLabel,
} from '@core/songs/importLabelMapping';

const labels: readonly Label[] = [
  '전주',
  '1절',
  '2절',
  '3절',
  '4절',
  '후렴',
  '프리코러스',
  '포스트코러스',
  '브리지',
  '간주',
  '후주',
  'Chorus',
].map(name => ({name, color: 'none', key: null}));

describe('import label suggestions', () => {
  it.each([
    [' 후렴 ', '후렴'],
    [' chorus ', 'Chorus'],
    ['Intro', '전주'],
    [' IN-TRO ', '전주'],
    ['Verse 1', '1절'],
    ['v 2', '2절'],
    [' V-3 ', '3절'],
    ['Verse 4', '4절'],
    ['Vers 4', '4절'],
    ['Chorus 2', 'Chorus 2'],
    ['4절', '4절'],
    ['Refrain', '후렴'],
    ['CHORUS', '후렴'],
    ['Chrous', '후렴'],
    ['Choru', '후렴'],
    ['Choruss', '후렴'],
    ['Chorusx', '후렴'],
    ['Pre-Chorus', '프리코러스'],
    ['PreChorus', '프리코러스'],
    ['Pre Chorus', '프리코러스'],
    ['PRE - CHORUS', '프리코러스'],
    ['Post-Chorus', '포스트코러스'],
    ['PostChorus', '포스트코러스'],
    [' post chorus ', '포스트코러스'],
    ['Bridge', '브리지'],
    [' 브릿지 ', '브리지'],
    ['Interlude', '간주'],
    ['Instrumental', '간주'],
    ['Ending', '후주'],
    ['Outro', '후주'],
    ['End', '후주'],
    ['엔딩', '후주'],
    ['PreXhorXs', '프리코러스'],
    ['ChXXus', 'ChXXus'],
    ['nterlud', '간주'],
    ['Tag', 'Tag'],
    ['  Unknown  ', 'Unknown'],
    ['endro', 'endro'],
    ['versed 4', '4절'],
  ])('suggests %s as %s', (header, expected) => {
    const list =
      header === ' chorus '
        ? labels
        : labels.filter(label => label.name !== 'Chorus');
    expect(suggestImportLabel(header, list)).toBe(expected);
  });

  it('keeps an ambiguous English typo rather than choosing one alias', () => {
    expect(suggestImportLabel('pchorus', labels)).toBe('pchorus');
    expect(suggestImportLabel('ontro', labels)).toBe('ontro');
  });

  it.each([
    ['Intro', '전주'],
    ['Chorus', '후렴'],
    ['Refrain', '후렴'],
    ['Chrous', '후렴'],
    ['Pre-Chorus', '프리코러스'],
    ['Post-Chorus', '포스트코러스'],
    ['PostChorus', '포스트코러스'],
    ['Bridge', '브리지'],
    ['브릿지', '브리지'],
    ['Interlude', '간주'],
    ['Instrumental', '간주'],
    ['Outro', '후주'],
    ['Ending', '후주'],
    ['End', '후주'],
    ['엔딩', '후주'],
  ])('keeps %s when the user has no %s label', (header, target) => {
    expect(
      suggestImportLabel(
        header,
        labels.filter(
          label => label.name !== target && label.name !== 'Chorus',
        ),
      ),
    ).toBe(header);
    expect(suggestImportLabel(header, [])).toBe(header);
  });

  it('still suggests a new numbered verse in an empty list and preserves exact user names before aliases', () => {
    expect(suggestImportLabel('Verse 4', [])).toBe('4절');
    expect(suggestImportLabel('V 5', [])).toBe('5절');
    const custom = [
      ...labels,
      ...['엔딩', '브릿지', 'Intro'].map(name => ({
        name,
        color: 'none' as const,
        key: null,
      })),
    ];
    expect(suggestImportLabel(' 엔딩 ', custom)).toBe('엔딩');
    expect(suggestImportLabel('브릿지', custom)).toBe('브릿지');
    expect(suggestImportLabel('intro', custom)).toBe('Intro');
  });

  it('maps every matching occurrence without changing lyrics, sections, or the original', () => {
    const draft = {
      title: 'Invented',
      slides: [
        {label: ' Chorus ', lines: ['First'], section: 0},
        {label: 'chorus', lines: ['Second'], section: 1},
        {label: 'Tag', lines: ['Third'], section: 2},
        {lines: ['Intro'], section: 3},
      ],
    };
    const mapped = applyImportLabelMapping(
      draft,
      new Map([
        ['chorus', '후렴'],
        ['tag', ''],
      ]),
    );
    expect(mapped.slides.map(slide => slide.label)).toEqual([
      '후렴',
      '후렴',
      '',
      undefined,
    ]);
    expect(mapped.slides.map(slide => slide.section)).toEqual([0, 1, 2, 3]);
    expect(mapped.slides.map(slide => slide.lines)).toEqual(
      draft.slides.map(slide => slide.lines),
    );
    expect(draft.slides[0]?.label).toBe(' Chorus ');
  });
});
