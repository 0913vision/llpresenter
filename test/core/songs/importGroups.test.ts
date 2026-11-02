import {describe, expect, it} from 'vitest';
import {importGroups} from '@core/songs/importGroups';

function ids() {
  let count = 0;
  return () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
}

function shape(slides: Parameters<typeof importGroups>[0]) {
  return importGroups(slides, ids()).map(group => ({
    name: group.name,
    lines: group.slides.map(slide => slide.lines),
  }));
}

describe('importGroups', () => {
  it('groups slides that share a label and a section', () => {
    expect(
      shape([
        {label: '1절', lines: ['a'], section: 0},
        {label: '1절', lines: ['b'], section: 0},
        {label: '후렴', lines: ['c'], section: 1},
      ]),
    ).toEqual([
      {name: '1절', lines: [['a'], ['b']]},
      {name: '후렴', lines: [['c']]},
    ]);
  });

  it('splits equal labels when the sections differ', () => {
    expect(
      shape([
        {label: '후렴', lines: ['a'], section: 0},
        {label: '후렴', lines: ['b'], section: 1},
      ]),
    ).toEqual([
      {name: '후렴', lines: [['a']]},
      {name: '후렴', lines: [['b']]},
    ]);
  });

  it('splits on a label change even when the section is the same', () => {
    expect(
      shape([
        {label: '1절', lines: ['a'], section: 0},
        {label: '후렴', lines: ['b'], section: 0},
      ]),
    ).toEqual([
      {name: '1절', lines: [['a']]},
      {name: '후렴', lines: [['b']]},
    ]);
  });

  it('names an unlabeled run with an empty name and gives each group its own id', () => {
    const groups = importGroups(
      [{lines: ['a']}, {label: '1절', lines: ['b']}],
      ids(),
    );
    expect(groups.map(group => group.name)).toEqual(['', '1절']);
    expect(new Set(groups.map(group => group.id)).size).toBe(2);
  });
});
