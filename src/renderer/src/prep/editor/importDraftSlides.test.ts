import {expect, it} from 'vitest';
import {editorGroupedSong} from './editorFixture';
import {
  ImportDraftLimitError,
  importDraftSlides,
} from '@core/songs/importDraftSlides';
import {parseGroupedSongDraft} from '@core/schema/groupedSong';

it('bounds total wire picks across arrangements without expanding the excess', () => {
  const {song} = editorGroupedSong(1);
  const group = song.groups[0];
  const single = song.groups[1];
  if (group === undefined || single === undefined) {
    throw new Error('Missing group');
  }
  const expanded = {
    ...song,
    groups: [
      {
        ...group,
        slides: Array.from({length: 4_999}, () => ({lines: ['Invented']})),
      },
      {...single, slides: [{lines: ['Invented']}]},
    ],
    arrangements: [
      {name: 'First', groups: [group.id, group.id, single.id, single.id]},
      {name: 'Second', groups: [group.id, group.id, single.id, single.id]},
    ],
  };
  const result = importDraftSlides(expanded);
  expect(result.arrangements?.map(item => item.slides.length)).toEqual([
    10_000, 10_000,
  ]);
  expect(() =>
    importDraftSlides({
      ...expanded,
      arrangements: [
        ...expanded.arrangements,
        {name: 'Excess', groups: [single.id]},
      ],
    }),
  ).toThrow(ImportDraftLimitError);
});

it('refuses a billion-slide arrangement without allocating the expanded wire', () => {
  const {song} = editorGroupedSong(1);
  const group = song.groups[0];
  if (group === undefined) throw new Error('Missing group');
  expect(() =>
    importDraftSlides({
      ...song,
      groups: [
        {
          ...group,
          slides: Array.from({length: 10_000}, () => ({lines: ['Invented']})),
        },
      ],
      arrangements: [
        {name: 'Large', groups: Array.from({length: 100_000}, () => group.id)},
      ],
    }),
  ).toThrow(ImportDraftLimitError);
});

it('keeps the master slides once and expands repeated groups in import arrangements', () => {
  const {song} = editorGroupedSong(1);
  const before = JSON.stringify(song);
  const draft = importDraftSlides(song);
  expect(draft.slides.map(slide => slide.label)).toEqual([
    '1절',
    '1절',
    '후렴',
  ]);
  expect(draft.slides.map(slide => slide.lines)).toEqual([
    ['새 아침을 노래해요', '함께 걸어요'],
    ['맑은 하늘 바라보며'],
    ['빛을 따라가요'],
  ]);
  expect(draft.arrangements).toEqual([
    {name: '주일용', slides: [1, 2, 3, 1, 2]},
  ]);
  expect(JSON.stringify(song)).toBe(before);
});

it('keeps empty arrangements and omitted arrangements distinct', () => {
  const {song} = editorGroupedSong(1);
  expect(
    importDraftSlides({...song, arrangements: [{name: 'Empty', groups: []}]})
      .arrangements,
  ).toEqual([{name: 'Empty', slides: []}]);
  const {arrangements: _arrangements, ...defaultSong} = song;
  expect(importDraftSlides(defaultSong)).not.toHaveProperty('arrangements');
});

it('retains unknown imported slide and arrangement fields', () => {
  const {song} = editorGroupedSong(1);
  const draft = importDraftSlides({
    ...song,
    groups: song.groups.map(group => ({
      ...group,
      slides: group.slides.map(slide => ({...slide, note: 'invented'})),
    })),
    arrangements:
      song.arrangements?.map(arrangement => ({
        ...arrangement,
        note: 'order',
      })) ?? [],
  });
  expect(draft).toHaveProperty('slides.0.note', 'invented');
  expect(draft).toHaveProperty('arrangements.0.note', 'order');
});

it('keeps adjacent same-name groups separate through the import wire', () => {
  const {song} = editorGroupedSong(1);
  const separate = {
    ...song,
    groups: song.groups.map(group => ({...group, name: 'Same name'})),
  };
  const {arrangements: _arrangements, ...master} = separate;
  const draft = importDraftSlides(master);
  const parsed = parseGroupedSongDraft(
    JSON.stringify({
      format: 'llsong',
      schemaVersion: 1,
      id: song.id,
      title: song.title,
      ...draft,
    }),
    'import-roundtrip.llsong',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  expect(
    parsed.value.data.groups.map(group => ({
      name: group.name,
      count: group.slides.length,
    })),
  ).toEqual([
    {name: 'Same name', count: 2},
    {name: 'Same name', count: 1},
  ]);
});
