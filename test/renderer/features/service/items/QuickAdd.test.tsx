import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {
  createMediaId,
  createServiceItemId,
  translationIdSchema,
} from '@core/schema/ids';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';
import {useShow} from '@renderer/session/show';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {useHeaderRename} from '@renderer/session/headerRename';
import {ServiceQuickAdd} from '@renderer/features/service/items/QuickAdd';
import {quickAddBefore} from '@core/services/quickAddPosition';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import type {RecentPassage} from '@core/schema/bible';
import {prepareLiturgy} from '@renderer/features/service/items/quickAddLiturgy';
import {newSlidesItem} from '@core/services/slidesEdits';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {isItemOfKind} from '@core/schema/service';

vi.mock('@renderer/features/service/items/quickAddLiturgy', () => ({
  prepareLiturgy: vi.fn(),
}));

afterEach(() => {
  useShow.setState({
    serviceId: null,
    readOnly: false,
    rows: [],
    openItemId: null,
  });
  delete window.llp;
  resetTooltips();
});

const dawn = createMediaId('60000000-0000-4000-8000-000000000012');

vi.mock('@core/services/quickAddPosition', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@core/services/quickAddPosition')>();
  return {...actual, quickAddBefore: vi.fn(actual.quickAddBefore)};
});

function mediaDocument() {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: [
        {id: dawn, name: '새벽 하늘', kind: 'video', file: 'b.mp4', size: 0},
      ],
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
}

function mockBible(
  api: ReturnType<typeof setup>['api'],
  defaultTranslation: {current: 'krv' | 'other'} = {current: 'krv'},
) {
  const krv = v.parse(translationIdSchema, 'krv');
  const other = v.parse(translationIdSchema, 'other');
  let recents: readonly RecentPassage[] = [];
  let revision = 1;
  const readSettings = api.settings.get;
  const editSettings = api.settings.edit;
  vi.spyOn(api.settings, 'edit').mockImplementation(async change => {
    if (change.type !== 'settings.update' || change.name !== 'bible') {
      return editSettings(change);
    }
    const parsed = parseSettingsDocument({
      name: 'bible',
      access: 'editable',
      revision: revision + 1,
      value: change.value,
    });
    if (!parsed.ok || parsed.value.name !== 'bible') {
      throw new Error('Invalid fixture history');
    }
    recents = parsed.value.value.recents;
    revision++;
    return {ok: true, value: {id: 'bible', revision}};
  });
  vi.spyOn(api.settings, 'get').mockImplementation(async request => {
    if (request.name !== 'bible') return readSettings(request);
    const parsed = parseSettingsDocument({
      name: 'bible',
      revision,
      access: 'editable',
      value: {
        format: 'llsettings.bible',
        schemaVersion: 1,
        translations: [
          {
            id: other,
            name: '다른',
            lang: 'ko',
            file: 'a.json',
            default: defaultTranslation.current === 'other',
          },
          {
            id: krv,
            name: '개역한글',
            lang: 'ko',
            file: 'b.json',
            default: defaultTranslation.current === 'krv',
          },
        ],
        recents,
      },
    });
    if (!parsed.ok) throw new Error('No bible');
    return parsed.value;
  });
  const lookup = vi
    .spyOn(api.bible, 'lookup')
    .mockImplementation(formLookupReply);
  return {krv, other, lookup, recents: () => recents};
}

function setup() {
  mockMenuRowHeight();
  Element.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const api = {
    ...fixture.api,
    media: {...fixture.api.media, get: () => Promise.resolve(mediaDocument())},
  };
  window.llp = api;
  useShow.setState({
    serviceId: fixtureServiceId,
    readOnly: false,
    rows: [{kind: 'header', id: fixtureItems.header, title: '찬양'}],
    openItemId: null,
  });
  const onProblem = vi.fn();
  render(<ServiceQuickAdd onProblem={onProblem} />);
  return {...fixture, api, onProblem, user: userEvent.setup()};
}

async function openBibleForm(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(screen.getByRole('button', {name: '항목 추가'}));
  await user.click(await screen.findByRole('menuitem', {name: '성경 구절…'}));
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).disabled,
    ).toBe(false),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', {name: '책'}),
    ),
  );
}

function fillBibleForm(end = ''): void {
  fireEvent.change(screen.getByRole('combobox', {name: '책'}), {
    target: {value: '요'},
  });
  fireEvent.change(screen.getByRole('textbox', {name: '장'}), {
    target: {value: '3'},
  });
  fireEvent.change(screen.getByRole('textbox', {name: '시작절'}), {
    target: {value: '16'},
  });
  if (end) {
    fireEvent.change(screen.getByRole('textbox', {name: '끝절'}), {
      target: {value: end},
    });
  }
}

describe('항목 추가', () => {
  it('adds a song after the last item of the selected section', async () => {
    const {user, service, first} = setup();
    useShow.setState({
      openItemId: fixtureItems.header,
      rows: [
        {kind: 'header', id: fixtureItems.header, title: '찬양'},
        {kind: 'song', id: fixtureItems.arranged, title: '첫 곡'},
        {kind: 'song', id: fixtureItems.plain, title: '다음 곡'},
        {kind: 'header', id: fixtureItems.slot, title: '헌금 찬양'},
        {kind: 'song', id: fixtureItems.lost, title: '마지막 곡'},
      ],
    });
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '곡…'}));
    await user.dblClick(
      await screen.findByRole('option', {name: first.song.title}),
    );
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    const order = service().service.order;
    const index = order.findIndex(item => item.id === fixtureItems.plain);
    expect(order[index + 1]).toMatchObject({song: first.song.id});
    expect(order[index + 2]?.id).toBe(fixtureItems.slot);
  });
  it('searches the library and inserts the chosen song immediately after the selected item', async () => {
    const {api, user, service, first} = setup();
    const rows = [
      {kind: 'song' as const, id: fixtureItems.arranged, title: '첫 곡'},
      {kind: 'song' as const, id: fixtureItems.plain, title: '다음 곡'},
    ];
    useShow.setState({openItemId: fixtureItems.arranged, rows});
    vi.spyOn(api.library, 'search').mockImplementation(async ({query}) => ({
      query,
      matches: [
        {
          songId: first.song.id,
          title: first.song.title,
          slideCount: 2,
          match: {kind: 'title'},
        },
      ],
    }));
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '곡…'}));
    await user.type(screen.getByRole('combobox', {name: '곡 검색'}), '새 노래');
    await user.click(
      await screen.findByRole('option', {name: first.song.title}),
    );
    await user.click(screen.getByRole('button', {name: '추가'}));
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    const order = service().service.order;
    const index = order.findIndex(item => item.id === fixtureItems.arranged);
    expect(order[index + 1]).toMatchObject({
      song: first.song.id,
      slides: first.song.slides,
    });
    expect(order[index + 2]?.id).toBe(fixtureItems.plain);
  });

  it('closes Bible suggestions before closing the passage dialog on Escape', async () => {
    const {api, user} = setup();
    mockBible(api);
    await openBibleForm(user);
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
    await user.type(book, '요');
    await waitFor(() =>
      expect(book.getAttribute('aria-expanded')).toBe('true'),
    );
    await user.keyboard('{Escape}');
    expect(book.getAttribute('aria-expanded')).toBe('false');
    expect(book.value).toBe('요');
    expect(screen.getByRole('dialog', {name: '성경 구절'})).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', {name: '성경 구절'})).toBeNull();
  });

  it.each(['찬양', '합심기도', '묵상기도', '축도'])(
    'inserts an editable %s section card after the selection with its gradient theme and one English slide',
    async name => {
      const {api, user, service, onProblem} = setup();
      const preparePictures = vi
        .spyOn(api.media, 'edit')
        .mockResolvedValue({ok: true, value: null});
      const open = vi
        .spyOn(api.slidesEditor, 'open')
        .mockResolvedValue({ok: true, value: undefined});
      useShow.setState({
        openItemId: fixtureItems.arranged,
        rows: [
          {kind: 'song', id: fixtureItems.arranged, title: '첫 곡'},
          {kind: 'song', id: fixtureItems.plain, title: '다음 곡'},
        ],
      });
      await user.click(screen.getByRole('button', {name: '항목 추가'}));
      await user.click(screen.getByRole('menuitem', {name: '구역 이름'}));
      await user.click(await screen.findByRole('menuitem', {name}));
      await waitFor(() => expect(open).toHaveBeenCalledOnce());
      expect(preparePictures).not.toHaveBeenCalled();
      expect(onProblem).not.toHaveBeenCalled();
      const section = SUNDAY_SECTIONS.find(section => section.name === name);
      const order = service().service.order;
      const index = order.findIndex(item => item.id === fixtureItems.arranged);
      const added = order[index + 1];
      expect(added).toMatchObject({
        theme: section?.theme,
        slides: {form: 'blank', name, slides: [{text: section?.english}]},
      });
      if (added === undefined || !isItemOfKind(added, 'slides')) {
        throw Error('Missing section card');
      }
      expect(added.slides.advance).toBeUndefined();
      expect(added.slides.loop).toBeUndefined();
      expect(added.slides.slides).toHaveLength(1);
      expect(order[index + 2]?.id).toBe(fixtureItems.plain);
      act(() =>
        useShow.setState(state => ({
          rows: [
            ...state.rows,
            {kind: 'slides', id: added.id, title: name, form: 'blank'},
          ],
        })),
      );
      expect(useShow.getState().openItemId).toBe(added.id);
      expect(open).toHaveBeenCalledWith({
        serviceId: fixtureServiceId,
        itemId: added.id,
      });
    },
  );
  it('inserts a prepared liturgy after the selected item and opens its slide commands', async () => {
    const {api, user, service} = setup();
    const item = newSlidesItem(
      'blank',
      createServiceItemId(crypto.randomUUID()),
    );
    vi.mocked(prepareLiturgy).mockResolvedValueOnce(item);
    const open = vi
      .spyOn(api.slidesEditor, 'open')
      .mockResolvedValue({ok: true, value: undefined});
    useShow.setState({
      openItemId: fixtureItems.arranged,
      rows: [
        {kind: 'song', id: fixtureItems.arranged, title: '첫 곡'},
        {kind: 'song', id: fixtureItems.plain, title: '다음 곡'},
      ],
    });
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '사도신경'}));
    await user.click(await screen.findByRole('menuitem', {name: '옛 번역'}));
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(prepareLiturgy).toHaveBeenCalledWith('creed', 'old');
    const order = service().service.order;
    const index = order.findIndex(row => row.id === fixtureItems.arranged);
    expect(order[index + 1]).toEqual(item);
    expect(order[index + 2]?.id).toBe(fixtureItems.plain);
    expect(open).toHaveBeenCalledWith({
      serviceId: fixtureServiceId,
      itemId: item.id,
    });
  });
  it.each(['빈 슬라이드', '광고'])(
    'inserts %s immediately after the selection, selects it and opens its editor',
    async label => {
      const {api, user, service} = setup();
      const open = vi
        .spyOn(api.slidesEditor, 'open')
        .mockResolvedValue({ok: true, value: undefined});
      useShow.setState({
        openItemId: fixtureItems.arranged,
        rows: [
          {kind: 'header', id: fixtureItems.header, title: '찬양'},
          {kind: 'song', id: fixtureItems.arranged, title: '첫 곡'},
          {kind: 'song', id: fixtureItems.plain, title: '다음 곡'},
        ],
      });
      await user.click(screen.getByRole('button', {name: '항목 추가'}));
      await user.click(screen.getByRole('menuitem', {name: label}));
      await waitFor(() => expect(open).toHaveBeenCalledOnce());
      const order = service().service.order;
      const index = order.findIndex(item => item.id === fixtureItems.arranged);
      const added = order[index + 1];
      expect(added).toMatchObject({
        slides: {form: label === '광고' ? 'ad' : 'blank'},
      });
      expect(order[index + 2]?.id).toBe(fixtureItems.plain);
      if (added === undefined || !isItemOfKind(added, 'slides')) {
        throw new Error('Missing inserted slide item');
      }
      act(() =>
        useShow.setState(state => ({
          rows: [
            ...state.rows,
            {
              kind: 'slides',
              id: added.id,
              title: label,
              form: added.slides.form,
            },
          ],
        })),
      );
      expect(useShow.getState().openItemId).toBe(added.id);
      expect(open).toHaveBeenCalledWith({
        serviceId: fixtureServiceId,
        itemId: added.id,
        ...(label === '빈 슬라이드' ? {focusText: true} : {}),
      });
    },
  );
  it('inserts a Bible item where the position rule puts it for the selected row', async () => {
    const {api, user, service, pushService} = setup();
    mockBible(api);
    const nextSection = fixtureItems.arranged;
    const emptySection = {
      id: fixtureItems.header,
      header: '빈 구역',
      future: {keep: true},
    };
    pushService({
      ...service(),
      revision: 40,
      service: {
        ...service().service,
        order: [emptySection, {id: nextSection, header: '다음 구역'}],
      },
    });
    act(() =>
      useShow.setState({
        rows: [
          {kind: 'header', id: fixtureItems.header, title: '빈 구역'},
          {kind: 'header', id: nextSection, title: '다음 구역'},
        ],
        openItemId: fixtureItems.header,
      }),
    );
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    expect(screen.queryByRole('menuitem', {name: '빈 자리'})).toBeNull();
    await user.click(await screen.findByRole('menuitem', {name: '성경 구절…'}));
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).disabled,
      ).toBe(false),
    );
    fillBibleForm();
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '추가'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    await user.click(screen.getByRole('textbox', {name: '시작절'}));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {name: '끝절'}),
    );
    expect(service().service.order).toHaveLength(2);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(service().service.order).toHaveLength(3));
    expect(quickAddBefore).toHaveBeenLastCalledWith(
      useShow.getState().rows,
      fixtureItems.header,
    );
    expect(service().service.order[0]).toEqual(emptySection);
    expect(service().service.order[1]).toMatchObject({
      bible: {ref: '요한복음 3:16'},
    });
    expect(service().service.order[2]).toEqual({
      id: nextSection,
      header: '다음 구역',
    });
  });

  it('inserts a new section and asks the list to rename it', async () => {
    const {user, service} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '구역 추가'}));
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    const added = service().service.order.at(-1);
    expect(added).toMatchObject({header: '새 구역'});
    expect(useHeaderRename.getState().requested).toBe(added?.id);
  });

  it('inserts a media item from the submenu', async () => {
    const {user, service} = setup();
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(screen.getByRole('menuitem', {name: '미디어'}));
    await user.click(await screen.findByRole('menuitem', {name: '새벽 하늘'}));
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    expect(service().service.order.at(-1)).toMatchObject({
      media: dawn,
    });
  });

  it.each(['Enter', 'button'] as const)(
    'inserts a clamped passage using %s with the opening defaults',
    async action => {
      const {api, user, service} = setup();
      const {krv, recents} = mockBible(api);
      await openBibleForm(user);
      fillBibleForm('99');
      const add = screen.getByRole('button', {name: '추가'});
      await waitFor(() =>
        expect(add.getAttribute('aria-disabled')).not.toBe('true'),
      );
      if (action === 'Enter') {
        await user.click(screen.getByRole('textbox', {name: '끝절'}));
        await user.keyboard('{Enter}');
      } else await user.click(add);
      await waitFor(() => expect(service().service.order).toHaveLength(6));
      expect(service().service.order.at(-1)).toMatchObject({
        bible: {
          translation: krv,
          ref: '요한복음 3:16-36',
          split: 'verse',
          reference: 'every',
          verseNumbers: true,
          translationName: false,
        },
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      await waitFor(() =>
        expect(recents()).toEqual([
          {translation: krv, ref: '요한복음 3:16-36'},
        ]),
      );
    },
  );

  it('forgets a closed opening and reads fresh defaults when reopened', async () => {
    const {api, user, service} = setup();
    const defaultTranslation: {current: 'krv' | 'other'} = {current: 'krv'};
    const {other, lookup} = mockBible(api, defaultTranslation);
    let finish: () => Promise<void> = async () => undefined;
    lookup.mockImplementationOnce(
      request =>
        new Promise(resolve => {
          finish = async () => resolve(await formLookupReply(request));
        }),
    );
    await openBibleForm(user);
    fillBibleForm();
    await waitFor(() => expect(lookup).toHaveBeenCalled());
    await user.click(screen.getByRole('button', {name: '취소'}));
    await act(finish);
    defaultTranslation.current = 'other';
    await openBibleForm(user);
    expect(
      screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).value,
    ).toBe('');
    fillBibleForm();
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '추가'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    await user.click(screen.getByRole('button', {name: '추가'}));
    await waitFor(() => expect(service().service.order).toHaveLength(6));
    expect(service().service.order.at(-1)).toMatchObject({
      bible: {translation: other},
    });
  });

  it('does not remember a passage when the service insertion fails', async () => {
    const {api, user, onProblem} = setup();
    const {recents} = mockBible(api);
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'read-only', message: 'Invented failure'},
    });
    await openBibleForm(user);
    fillBibleForm();
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', {name: '추가'})
          .getAttribute('aria-disabled'),
      ).not.toBe('true'),
    );
    await user.click(screen.getByRole('button', {name: '추가'}));
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    expect(recents()).toEqual([]);
  });

  it('remembers an applied Bible insertion after a save failure and shows the warning', async () => {
    const {api, user, service, onProblem} = setup();
    const {krv, recents} = mockBible(api);
    const edit = api.content.edit;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async change => {
      const applied = await edit(change);
      if (!applied.ok) throw Error('Fixture did not apply');
      return {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Invented failure',
          applied: applied.value,
          unchangedFiles: ['service.llservice'],
        },
      };
    });
    await openBibleForm(user);
    fillBibleForm();
    const add = screen.getByRole('button', {name: '추가'});
    await waitFor(() =>
      expect(add.getAttribute('aria-disabled')).not.toBe('true'),
    );
    await user.click(add);
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({title: '예배 저장 실패'}),
    );
    expect(service().service.order).toHaveLength(6);
    await waitFor(() =>
      expect(recents()).toEqual([{translation: krv, ref: '요한복음 3:16'}]),
    );
  });

  it('is unavailable for a read-only service, with the reason', async () => {
    setup();
    act(() => useShow.setState({readOnly: true}));
    const add = screen.getByRole('button', {name: '항목 추가'});
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(add))?.textContent).toBe(NEWER_FILE_REASON);
  });
});
