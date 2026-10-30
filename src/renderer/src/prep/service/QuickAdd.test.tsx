import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {createMediaId, translationIdSchema} from '@shared/schema/ids';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {mockMenuRowHeight} from '@renderer/prep/editor/editorTesting';
import {useShow} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {NEWER_FILE_REASON} from './ItemArrangement';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {useHeaderRename} from '@renderer/state/headerRename';
import {ServiceQuickAdd} from './QuickAdd';
import {formLookupReply} from '@renderer/show/bible/testing/referenceForm';
import type {RecentPassage} from '@shared/schema/bible';

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
  return {...fixture, onProblem, user: userEvent.setup()};
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
  it('lists only non-song rows and does not search the library', async () => {
    const {api, user} = setup();
    const search = vi.spyOn(api.library, 'search');
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    const menu = screen.getByRole('menu', {name: '항목 추가'});
    expect(within(menu).queryByRole('combobox')).toBeNull();
    expect(within(menu).queryByText('라이브러리')).toBeNull();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(row => row.textContent),
    ).toEqual([
      '구역 추가',
      '자리 표시 추가',
      '큐 추가',
      '미디어',
      '성경 구절…',
      '공지',
      '비디오 스트림 항목…',
      '오디오 스트림 항목…',
    ]);
    expect(search).not.toHaveBeenCalled();
  });
  it('adds a Bible item into the selected empty section without replacing it', async () => {
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
    await waitFor(() => expect(service().service.order).toHaveLength(3));
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

  it('lifts book suggestions over the dialog and accepts a pointer choice', async () => {
    const {api, user, service} = setup();
    mockBible(api);
    const length = service().service.order.length;
    await openBibleForm(user);
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
    await user.type(book, '요');
    const list = screen.getByRole('listbox', {name: '성경 구절 추천'});
    expect(list.hasAttribute('data-over-modal')).toBe(true);
    expect(list.closest('[inert]')).toBeNull();
    await user.click(within(list).getByRole('option', {name: '요한복음'}));
    expect(book.value).toBe('요한복음');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(service().service.order).toHaveLength(length);
    expect(screen.getByRole('dialog', {name: '성경 구절'})).toBeTruthy();
  });

  it('shares completion, blocks ambiguous Tab, and advances to the next field', async () => {
    const {api, user, service} = setup();
    mockBible(api).lookup.mockImplementation(
      () => new Promise(() => undefined),
    );
    const length = service().service.order.length;
    await user.click(screen.getByRole('button', {name: '항목 추가'}));
    await user.click(await screen.findByRole('menuitem', {name: '성경 구절…'}));
    const field = await screen.findByRole<HTMLInputElement>('combobox', {
      name: '책',
    });
    await waitFor(() => expect(field.disabled).toBe(false));
    fireEvent.change(field, {target: {value: '베'}});
    field.focus();
    await user.tab();
    expect(document.activeElement).toBe(field);
    await user.keyboard('{ArrowDown}{ArrowDown}{Tab}');
    expect(field.value).toBe('베드로전서');
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', {name: '장'}),
    );
    expect(service().service.order).toHaveLength(length);
    expect(screen.getByRole('dialog', {name: '성경 구절'})).toBeTruthy();
  });

  it('keeps an unavailable arrow pick in the book field and cannot insert the previous valid passage', async () => {
    const {api, user, service} = setup();
    mockBible(api).lookup.mockImplementation(request =>
      formLookupReply(request, [43]),
    );
    const length = service().service.order.length;
    await openBibleForm(user);
    fillBibleForm();
    const add = screen.getByRole('button', {name: '추가'});
    await waitFor(() =>
      expect(add.getAttribute('aria-disabled')).not.toBe('true'),
    );
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
    await user.clear(book);
    await user.type(book, '베');
    await user.keyboard('{ArrowDown}{Tab}');
    await waitFor(() => expect(book.getAttribute('aria-invalid')).toBe('true'));
    expect(book.value).toBe('에베소서');
    expect(document.activeElement).toBe(book);
    await waitFor(() => expect(add.getAttribute('aria-disabled')).toBe('true'));
    await user.click(add);
    expect(service().service.order).toHaveLength(length);
    expect(screen.getByRole('dialog', {name: '성경 구절'})).toBeTruthy();
  });

  it.each([
    ['장', '22'],
    ['시작절', '37'],
    ['끝절', '15'],
  ] as const)(
    'blocks an invalid %s and cannot insert it with Enter or the button',
    async (label, value) => {
      const {api, user, service} = setup();
      mockBible(api);
      const length = service().service.order.length;
      await openBibleForm(user);
      fillBibleForm();
      await waitFor(() =>
        expect(
          screen
            .getByRole('button', {name: '추가'})
            .getAttribute('aria-disabled'),
        ).not.toBe('true'),
      );
      const field = screen.getByRole('textbox', {name: label});
      fireEvent.change(field, {target: {value}});
      await user.click(field);
      await user.tab();
      expect(document.activeElement).toBe(field);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      await user.keyboard('{Enter}');
      await user.click(screen.getByRole('button', {name: '추가'}));
      expect(service().service.order).toHaveLength(length);
    },
  );

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
      expect.objectContaining({title: '예배 순서 저장 실패'}),
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
