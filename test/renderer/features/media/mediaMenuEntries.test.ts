import {expect, it, vi} from 'vitest';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {mediaItem} from '@fixtures/renderer/features/media/mediaTesting';
import {
  mediaTileMenuEntries,
  playlistMenuEntries,
  type MediaTileActions,
} from '@renderer/features/media/mediaMenuEntries';

function actions(overrides: Partial<MediaTileActions> = {}): MediaTileActions {
  return {
    missing: false,
    editable: true,
    inPlaylist: false,
    audioPlaylist: false,
    properties: vi.fn(),
    cancel: vi.fn(),
    relink: vi.fn(),
    leave: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    reveal: vi.fn(),
    rename: vi.fn(),
    setProps: vi.fn(),
    ...overrides,
  };
}

function rows(entries: readonly MenuEntry[]): readonly string[] {
  return entries.map(entry => (entry.kind === 'separator' ? '|' : entry.label));
}

const item = mediaItem(1, {name: 'Invented video'});
const entry = {kind: 'media' as const, id: item.id, item, copying: undefined};

it('lists the media tile rows and icons in ProPresenter order', () => {
  const entries = mediaTileMenuEntries(entry, actions());
  expect(rows(entries)).toEqual([
    '속성…',
    '전환 효과…',
    '|',
    '동작',
    '맞춤',
    '알파',
    '|',
    '재생',
    '반복',
    '끝나면',
    '|',
    '다음 항목',
    '|',
    '잘라내기',
    '복사',
    '붙여넣기',
    '복제',
    '이름 바꾸기',
    '삭제',
    '|',
    '탐색기에서 보기',
    '정리 기준',
  ]);
  expect(
    entries
      .filter(row => row.kind === 'item' && row.icon !== undefined)
      .map(row => row.id),
  ).toEqual(['cut', 'copy', 'paste', 'duplicate', 'delete']);
  for (const row of entries) {
    if (
      row.kind === 'item' &&
      ![
        'delete',
        'properties',
        'duplicate',
        'rename',
        'reveal',
        'scaling',
        'end',
      ].includes(row.id)
    ) {
      expect(row).toMatchObject({
        disabled: true,
        title: '이번 버전에서는 쓸 수 없음',
      });
    }
  }
});

it('lists the audio playlist item rows without icons', () => {
  const entries = mediaTileMenuEntries(
    entry,
    actions({audioPlaylist: true, inPlaylist: true}),
  );
  expect(rows(entries)).toEqual([
    '탐색기에서 보기',
    '재생',
    '효과음으로 지정',
    '|',
    '속성…',
    '복제',
    '이름 바꾸기',
    '|',
    '삭제',
  ]);
  expect(
    entries.some(row => row.kind === 'item' && row.icon !== undefined),
  ).toBe(false);
});

it('keeps relink first, removal before delete, and only cancellation while copying', () => {
  const handlers = actions({missing: true, inPlaylist: true});
  const entries = mediaTileMenuEntries(entry, handlers);
  expect(rows(entries).slice(0, 3)).toEqual(['다시 연결…', '|', '속성…']);
  expect(rows(entries).slice(-5)).toEqual([
    '재생목록에서 빼기',
    '삭제',
    '|',
    '탐색기에서 보기',
    '정리 기준',
  ]);
  for (const id of ['relink', 'leave', 'delete']) {
    const row = entries.find(value => value.id === id);
    if (row?.kind !== 'item') throw new Error('Missing action');
    row.onSelect?.();
  }
  expect(handlers.relink).toHaveBeenCalledWith(item.id);
  expect(handlers.leave).toHaveBeenCalledWith(item.id);
  expect(handlers.remove).toHaveBeenCalledWith(item);
  const copying = mediaTileMenuEntries({...entry, copying: 20}, handlers);
  expect(rows(copying)).toEqual(['복사 멈추기']);
  const cancel = copying[0];
  if (cancel?.kind !== 'item') throw new Error('Missing cancellation');
  cancel.onSelect?.();
  expect(handlers.cancel).toHaveBeenCalledWith(item.id);
});

it('lists playlist commands in ProPresenter order and protects read-only lists', () => {
  const entries = playlistMenuEntries(true);
  expect(rows(entries)).toEqual([
    '통신에 사용',
    '|',
    '이름 바꾸기',
    '복제',
    '삭제',
  ]);
  expect(
    playlistMenuEntries(false).every(
      row => row.kind !== 'item' || row.disabled,
    ),
  ).toBe(true);
  expect(
    mediaTileMenuEntries(entry, actions({editable: false})).every(
      row =>
        row.kind !== 'item' ||
        row.id === 'properties' ||
        row.id === 'reveal' ||
        row.disabled,
    ),
  ).toBe(true);
});

it.each([false, true])(
  'runs 탐색기에서 보기 and 이름 바꾸기 as commands (audio list %s)',
  audioPlaylist => {
    const reveal = vi.fn();
    const rename = vi.fn();
    const list = mediaTileMenuEntries(
      entry,
      actions({audioPlaylist, reveal, rename}),
    );
    const find = (id: string) =>
      list.find(row => row.kind === 'item' && row.id === id);
    const revealRow = find('reveal');
    const renameRow = find('rename');
    if (revealRow?.kind !== 'item' || renameRow?.kind !== 'item') {
      throw new Error('Missing rows');
    }
    expect(revealRow.disabled).not.toBe(true);
    expect(renameRow.disabled).not.toBe(true);
    revealRow.onSelect?.();
    renameRow.onSelect?.();
    expect(reveal).toHaveBeenCalledExactlyOnceWith(item.id);
    expect(rename).toHaveBeenCalledExactlyOnceWith(item);
  },
);

it('protects a list a newer version wrote from a rename', () => {
  const list = mediaTileMenuEntries(entry, actions({editable: false}));
  const renameRow = list.find(
    row => row.kind === 'item' && row.id === 'rename',
  );
  expect(renameRow).toMatchObject({
    disabled: true,
    title: '새 버전의 파일이라 바꿀 수 없습니다',
  });
});

function choices(entries: readonly MenuEntry[], id: string) {
  const row = entries.find(entry => entry.id === id);
  if (row?.kind !== 'item') throw new Error(`Missing row ${id}`);
  return row;
}

it('shows the current 맞춤 and 끝나면 with a check and writes the property 미디어 속성 writes', () => {
  const setProps = vi.fn();
  const video = mediaItem(1, {
    name: 'Invented video',
    kind: 'video',
    props: {fit: 'stretch', end: 'stop'},
  });
  const entries = mediaTileMenuEntries(
    {kind: 'media', id: video.id, item: video, copying: undefined},
    actions({setProps}),
  );
  const fit = choices(entries, 'scaling');
  expect(
    fit.submenu?.map(row => row.kind === 'item' && [row.label, row.checked]),
  ).toEqual([
    ['맞추기', false],
    ['채우기', false],
    ['늘리기', true],
  ]);
  const end = choices(entries, 'end');
  expect(
    end.submenu?.map(row => row.kind === 'item' && [row.label, row.checked]),
  ).toEqual([
    ['반복', false],
    ['정지', true],
  ]);
  const pick = (row: ReturnType<typeof choices>, label: string) => {
    const choice = row.submenu?.find(
      entry => entry.kind === 'item' && entry.label === label,
    );
    if (choice?.kind !== 'item') throw new Error(`Missing ${label}`);
    choice.onSelect?.();
  };
  pick(fit, '맞추기');
  pick(end, '반복');
  expect(setProps).toHaveBeenNthCalledWith(1, video.id, {fit: 'fit'});
  expect(setProps).toHaveBeenNthCalledWith(2, video.id, {end: 'loop'});
  expect(choices(entries, 'loop').disabled).toBe(true);
});

it('checks the defaults 채우기 and 반복 for a media with no properties', () => {
  const entries = mediaTileMenuEntries(entry, actions());
  const checked = (id: string) =>
    choices(entries, id).submenu?.flatMap(row =>
      row.kind === 'item' && row.checked === true ? [row.label] : [],
    );
  expect(checked('scaling')).toEqual(['채우기']);
  expect(checked('end')).toEqual(['반복']);
});

it('turns off 맞춤 and 끝나면 for a list a newer version wrote, and 끝나면 for an image', () => {
  const newer = mediaTileMenuEntries(entry, actions({editable: false}));
  expect(choices(newer, 'scaling').disabled).toBe(true);
  expect(choices(newer, 'end').disabled).toBe(true);
  const image = mediaItem(2, {name: 'Invented image', kind: 'image'});
  const entries = mediaTileMenuEntries(
    {kind: 'media', id: image.id, item: image, copying: undefined},
    actions(),
  );
  expect(choices(entries, 'scaling').disabled).toBe(false);
  expect(choices(entries, 'end')).toMatchObject({
    disabled: true,
    title: '이미지에는 재생이 없음',
  });
});

it('offers neither row for an audio tile', () => {
  const audio = mediaItem(3, {name: 'Invented audio', kind: 'audio'});
  const ids = mediaTileMenuEntries(
    {kind: 'media', id: audio.id, item: audio, copying: undefined},
    actions({audioPlaylist: true}),
  ).map(row => row.id);
  expect(ids).not.toContain('scaling');
  expect(ids).not.toContain('end');
});
