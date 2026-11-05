import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
  createSlideId,
  createThemeId,
  translationIdSchema,
} from '@core/schema/ids';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {parsePayload} from '@core/schema/payload';
import type {SlidesItem} from '@core/services/slidesEdits';
import {newSlidesItem} from '@core/services/slidesEdits';
import {SlidesEditorWindow} from '@renderer/app/SlidesEditorWindow';
import {ControlSession} from '@renderer/app/controlSession';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {
  recordItemEdit,
  serviceOrderEditsFor,
} from '@renderer/session/serviceOrderEdits';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';

vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: () => <div />,
}));
const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const itemId = createServiceItemId('00000000-0000-4000-8000-000000000002');
const mediaId = createMediaId('00000000-0000-4000-8000-000000000003');
const slideId = createSlideId('00000000-0000-4000-8000-000000000004');

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function setup(
  form: 'blank' | 'ad' = 'ad',
  slides?: SlidesItem['slides']['slides'],
) {
  const item: SlidesItem = {
    ...newSlidesItem(form, itemId),
    slides: {
      ...newSlidesItem(form, itemId).slides,
      slides: slides ?? [
        {
          id: slideId,
          text: '첫 내용',
          ...(form === 'ad' ? {name: '첫 소식'} : {}),
        },
        {
          id: createSlideId('00000000-0000-4000-8000-000000000005'),
          media: mediaId,
        },
      ],
    },
  };
  let document: ServiceDocument = {
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: serviceId,
      name: '예배',
      date: '2026-11-05T11:00',
      order: [item],
    },
    revision: 1,
    access: 'editable',
  };
  const original = document;
  const listeners = new Set<(target: SlidesEditorTarget | null) => void>();
  const content = vi.fn<ReturnType<typeof mockLlpApi>['content']['edit']>(
    async edit => {
      if (edit.type !== 'service.update') throw new Error('Unexpected edit');
      document = {
        ...document,
        service: edit.service,
        revision: document.revision + 1,
      };
      return {ok: true, value: {id: serviceId, revision: document.revision}};
    },
  );
  const base = editorFixture().api;
  const control = mockLlpApi({
    services: {get: async () => document},
    content: {edit: content},
  });
  const saved = vi.fn<ReturnType<typeof mockLlpApi>['slidesEditor']['saved']>(
    entry => {
      recordItemEdit(control, {
        serviceId: entry.before.id,
        before: entry.before.order,
        after: entry.after.order,
      });
    },
  );
  const api = mockLlpApi({
    settings: base.settings,
    services: {get: async () => document},
    content: {edit: content},
    media: {
      get: async () => ({
        name: 'media',
        revision: 1,
        access: 'editable',
        value: {
          format: 'llmedia',
          schemaVersion: 1,
          playlists: [],
          audioPlaylists: [],
          items: [
            {
              id: mediaId,
              kind: 'image',
              name: '그림',
              file: 'poster.jpg',
              size: 0,
            },
          ],
        },
      }),
    },
    slidesEditor: {
      target: async () => ({serviceId, itemId}),
      onRetarget: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      saved,
    },
  });
  const session = new ControlSession(api);
  const view = render(<SlidesEditorWindow session={session} />);
  return {
    api,
    control,
    item,
    original,
    content,
    saved,
    view,
    session,
    document: () => document,
    replaceDocument: (next: ServiceDocument): void => {
      document = next;
    },
    retarget: (target: SlidesEditorTarget) =>
      act(() => {
        for (const listen of listeners) listen(target);
      }),
  };
}

describe('slides editor', () => {
  it.each([
    {field: 'item-name', outcome: 'saved'},
    {field: 'slide-name', outcome: 'saved'},
    {field: 'text', outcome: 'saved'},
    {field: 'text', outcome: 'failed'},
  ] as const)(
    'restores $field focus and selection after keyboard save ($outcome) for continued typing and undo',
    async ({field, outcome}) => {
      const f = setup();
      onTestFinished(async () => {
        f.view.unmount();
        await f.session.dispose();
      });
      await screen.findByRole('textbox', {name: '내용'});
      const label = {
        'item-name': '이름',
        'slide-name': '슬라이드 이름',
        text: '내용',
      }[field];
      const input = screen.getByRole<HTMLInputElement | HTMLTextAreaElement>(
        'textbox',
        {name: label},
      );
      await userEvent.click(input);
      await userEvent.keyboard('{Control>}a{/Control}Before save');
      input.setSelectionRange(2, 6, 'backward');
      let finish = (): void => {};
      const gate = new Promise<void>(resolve => {
        finish = resolve;
      });
      onTestFinished(finish);
      const write = f.content.getMockImplementation();
      if (write === undefined) throw new Error('Missing save implementation');
      f.content.mockImplementationOnce(async request => {
        await gate;
        return outcome === 'saved'
          ? write(request)
          : {ok: false, error: {reason: 'stale', message: 'Changed'}};
      });
      await userEvent.keyboard('{Control>}s{/Control}');
      await waitFor(() => expect(f.content).toHaveBeenCalledOnce());
      expect(input.closest('fieldset')?.disabled).toBe(true);
      /** Model the browser's focus loss, which JSDOM omits for disabled fields. */
      act(() => {
        document.body.tabIndex = -1;
        document.body.focus();
        document.body.removeAttribute('tabindex');
        input.setSelectionRange(0, 0);
      });
      expect(document.activeElement).toBe(document.body);
      await act(async () => {
        finish();
        await gate;
      });
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(6);
      expect(input.selectionDirection).toBe('backward');
      await userEvent.keyboard('!');
      expect(input.value).toBe('Be! save');
      await userEvent.keyboard('{Control>}z{/Control}');
      expect(input.value).toBe('Before save');
      await userEvent.keyboard('{Control>}y{/Control}');
      expect(input.value).toBe('Be! save');
      if (outcome === 'saved') expect(f.saved).toHaveBeenCalledOnce();
      else expect(f.saved).not.toHaveBeenCalled();
    },
  );

  it('keeps a retarget confirmation focused when a keyboard save finishes', async () => {
    const f = setup();
    onTestFinished(async () => {
      f.view.unmount();
      await f.session.dispose();
    });
    const input = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '내용',
    });
    await userEvent.click(input);
    await userEvent.keyboard('Changed');
    let finish = (): void => {};
    const gate = new Promise<void>(resolve => {
      finish = resolve;
    });
    onTestFinished(finish);
    const write = f.content.getMockImplementation();
    if (write === undefined) throw new Error('Missing save implementation');
    f.content.mockImplementationOnce(async request => {
      await gate;
      return write(request);
    });
    await userEvent.keyboard('{Control>}s{/Control}');
    await waitFor(() => expect(f.content).toHaveBeenCalledOnce());
    f.retarget({
      serviceId,
      itemId: createServiceItemId('00000000-0000-4000-8000-000000000006'),
    });
    const confirmation = await screen.findByRole('alertdialog');
    expect(confirmation.contains(document.activeElement)).toBe(true);
    await act(async () => {
      finish();
      await gate;
    });
    await waitFor(() => expect(f.saved).toHaveBeenCalledOnce());
    expect(confirmation.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(input);
  });

  it('keeps the new verse reference readable and preserves it when saving another field', async () => {
    const parsed = parsePayload(translationIdSchema, 'sample');
    if (!parsed.ok) throw new Error('Invalid translation fixture');
    const verse = {
      id: slideId,
      verse: {translation: parsed.value, book: 43, chapter: 3, verse: 16},
    };
    const f = setup('blank', [verse]);
    onTestFinished(async () => {
      f.view.unmount();
      await f.session.dispose();
    });
    await screen.findByText('성경 구절');
    expect(screen.getAllByText('요 3:16').length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox', {name: '글'})).toBeNull();
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: 'Updated verse item'},
    });
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(f.saved).toHaveBeenCalledOnce());
    expect(f.document().service.order[0]).toMatchObject({
      slides: {name: 'Updated verse item', slides: [verse]},
    });
  });

  it('preserves concurrent control-window fields when only editor text changes, including another save', async () => {
    const f = setup();
    onTestFinished(async () => {
      f.view.unmount();
      await f.session.dispose();
    });
    const text = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '내용',
    });
    fireEvent.change(text, {target: {value: 'Editor text'}});
    const fresh = {
      ...f.item,
      theme: createThemeId('00000000-0000-4000-8000-000000000101'),
      memo: 'Concurrent memo',
      slides: {
        ...f.item.slides,
        name: 'Control name',
        advance: 20,
        loop: false,
      },
    };
    f.replaceDocument({
      ...f.document(),
      revision: 2,
      service: {...f.document().service, order: [fresh]},
    });
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(f.saved).toHaveBeenCalledOnce());
    expect(f.document().service.order[0]).toMatchObject({
      ...fresh,
      slides: {
        ...fresh.slides,
        slides: [{text: 'Editor text'}, {media: mediaId}],
      },
    });
    fireEvent.change(text, {target: {value: 'Second editor text'}});
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(f.saved).toHaveBeenCalledTimes(2));
    expect(f.document().service.order[0]).toMatchObject({
      ...fresh,
      slides: {
        ...fresh.slides,
        slides: [{text: 'Second editor text'}, {media: mediaId}],
      },
    });
  });

  it.each(['slide', 'name'] as const)(
    'keeps the editor draft and reports a conflicting concurrent %s change without writing',
    async field => {
      const f = setup();
      onTestFinished(async () => {
        f.view.unmount();
        await f.session.dispose();
      });
      const text = await screen.findByRole<HTMLTextAreaElement>('textbox', {
        name: '내용',
      });
      const edited =
        field === 'slide'
          ? text
          : screen.getByRole<HTMLInputElement>('textbox', {name: '이름'});
      fireEvent.change(edited, {target: {value: 'Editor value'}});
      const fresh = {
        ...f.item,
        slides: {
          ...f.item.slides,
          ...(field === 'slide'
            ? {slides: [{id: slideId, text: 'Concurrent text'}]}
            : {name: 'Concurrent name'}),
        },
      };
      f.replaceDocument({
        ...f.document(),
        revision: 2,
        service: {...f.document().service, order: [fresh]},
      });
      await userEvent.click(screen.getByRole('button', {name: '저장'}));
      await screen.findByText('다른 창에서 같은 내용을 바꿨습니다');
      expect(f.content).not.toHaveBeenCalled();
      expect(edited.value).toBe('Editor value');
      expect(f.document().service.order[0]).toEqual(fresh);
    },
  );

  it.each(['cancel', 'replace', 'reopen'] as const)(
    'cancels an in-flight save-and-leave without taking the canceled target (%s)',
    async action => {
      const f = setup();
      onTestFinished(async () => {
        f.view.unmount();
        await f.session.dispose();
      });
      const nextId = createServiceItemId(
        '00000000-0000-4000-8000-000000000010',
      );
      const latestId = createServiceItemId(
        '00000000-0000-4000-8000-000000000011',
      );
      const next = newSlidesItem('blank', nextId);
      const latest = {
        ...newSlidesItem('blank', latestId),
        slides: {
          ...newSlidesItem('blank', latestId).slides,
          name: 'Latest target',
        },
      };
      f.replaceDocument({
        ...f.document(),
        service: {...f.document().service, order: [f.item, next, latest]},
      });
      const text = await screen.findByRole<HTMLTextAreaElement>('textbox', {
        name: '내용',
      });
      fireEvent.change(text, {target: {value: 'Saved text'}});
      let finish = (): void => undefined;
      const gate = new Promise<void>(resolve => {
        finish = resolve;
      });
      const write = f.content.getMockImplementation();
      if (write === undefined) throw new Error('Missing content write');
      f.content.mockImplementationOnce(async edit => {
        await gate;
        return write(edit);
      });
      f.retarget({serviceId, itemId: nextId});
      const confirmation = await screen.findByRole('alertdialog');
      await userEvent.click(
        within(confirmation).getByRole('button', {name: '저장'}),
      );
      await waitFor(() => expect(f.content).toHaveBeenCalledOnce());
      if (action === 'reopen') f.retarget({serviceId, itemId});
      else {
        await userEvent.click(
          within(confirmation).getByRole('button', {name: '취소'}),
        );
      }
      expect(screen.queryByRole('alertdialog')).toBeNull();
      if (action === 'replace') f.retarget({serviceId, itemId: latestId});
      await act(async () => {
        finish();
        await gate;
      });
      await waitFor(() => expect(f.saved).toHaveBeenCalledOnce());
      expect(
        screen.getByRole<HTMLInputElement>('textbox', {
          name: '이름',
        }).value,
      ).toBe('광고');
      expect(screen.queryByRole('alertdialog') !== null).toBe(
        action === 'replace',
      );
      if (action === 'replace') {
        await userEvent.click(
          within(screen.getByRole('alertdialog')).getByRole('button', {
            name: '저장 안 함',
          }),
        );
        await waitFor(() =>
          expect(
            screen.getByRole<HTMLInputElement>('textbox', {
              name: '이름',
            }).value,
          ).toBe('Latest target'),
        );
      }
    },
  );

  it('keeps keyboard undo reachable after deleting the focused last row and then every remaining row', async () => {
    const f = setup();
    onTestFinished(async () => {
      f.view.unmount();
      await f.session.dispose();
    });
    await screen.findByRole('textbox', {name: '내용'});
    const rows = () => [
      ...document.querySelectorAll<HTMLElement>('[data-slide-id]'),
    ];
    const last = rows().at(-1);
    if (last === undefined) throw new Error('Missing last row');
    act(() => last.focus());
    await userEvent.keyboard('{Delete}');
    expect(rows()).toHaveLength(1);
    expect(document.activeElement).toBe(rows()[0]);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(rows()).toHaveLength(2);
    await userEvent.keyboard('{Control>}y{/Control}');
    expect(rows()).toHaveLength(1);
    await userEvent.keyboard('{Delete}');
    expect(rows()).toHaveLength(0);
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '글 추가'}),
    );
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(rows()).toHaveLength(1);
  });

  it.each(['undo-add', 'redo-delete'] as const)(
    'keeps keyboard history reachable when %s removes the focused input row',
    async action => {
      const f = setup();
      onTestFinished(async () => {
        f.view.unmount();
        await f.session.dispose();
      });
      await screen.findByRole('textbox', {name: '내용'});
      await userEvent.click(screen.getByRole('button', {name: '글 추가'}));
      if (action === 'redo-delete') {
        const added =
          document.querySelectorAll<HTMLElement>('[data-slide-id]')[2];
        if (added === undefined) throw new Error('Missing added row');
        act(() => added.focus());
        await userEvent.keyboard('{Delete}');
        await userEvent.keyboard('{Control>}z{/Control}');
      }
      const input = screen.getAllByRole<HTMLTextAreaElement>('textbox', {
        name: '내용',
      })[1];
      if (input === undefined) throw new Error('Missing added input');
      await userEvent.click(input);
      await userEvent.keyboard(
        action === 'undo-add'
          ? '{Control>}z{/Control}'
          : '{Control>}y{/Control}',
      );
      expect(input.isConnected).toBe(false);
      expect(screen.getAllByRole('textbox', {name: '내용'})).toHaveLength(1);
      expect(document.activeElement?.closest('[data-slide-id]')).toBeTruthy();
      await userEvent.keyboard(
        action === 'undo-add'
          ? '{Control>}y{/Control}'
          : '{Control>}z{/Control}',
      );
      expect(screen.getAllByRole('textbox', {name: '내용'})).toHaveLength(2);
    },
  );

  it.each(['blank', 'ad'] as const)(
    'shows the %s text fields and picture filename with replacement',
    async form => {
      const {session, view} = setup(form);
      expect(
        (
          await screen.findByRole<HTMLTextAreaElement>('textbox', {
            name: form === 'ad' ? '내용' : '글',
          })
        ).value,
      ).toBe('첫 내용');
      expect(
        screen.queryByRole('textbox', {name: '슬라이드 이름'}) !== null,
      ).toBe(form === 'ad');
      expect(await screen.findAllByText('poster.jpg')).not.toHaveLength(0);
      expect(screen.getByRole('button', {name: '바꾸기…'})).toBeTruthy();
      expect(screen.getByRole('radio', {name: '청중 화면'})).toBeTruthy();
      view.unmount();
      await session.dispose();
    },
  );

  it('adds text, deletes a selected slide, and undoes and redoes inside the window', async () => {
    setup();
    await screen.findByRole('textbox', {name: '내용'});
    await userEvent.click(screen.getByRole('button', {name: '글 추가'}));
    expect(screen.getAllByRole('textbox', {name: '내용'})).toHaveLength(2);
    const rows = document.querySelectorAll<HTMLElement>('[data-slide-id]');
    const last = rows[2];
    if (last === undefined) throw new Error('Missing slide row');
    last.focus();
    fireEvent.keyDown(last, {key: 'Delete'});
    expect(screen.getAllByRole('textbox', {name: '내용'})).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('textbox', {name: '내용'}), {
      key: 'z',
      ctrlKey: true,
    });
    expect(screen.getAllByRole('textbox', {name: '내용'})).toHaveLength(2);
    fireEvent.keyDown(
      screen.getAllByRole('textbox', {name: '내용'})[0] ?? last,
      {key: 'y', ctrlKey: true},
    );
    expect(screen.getAllByRole('textbox', {name: '내용'})).toHaveLength(1);
  });

  it('reorders rows by dragging and removes from the context menu', async () => {
    setup();
    await screen.findByRole('textbox', {name: '내용'});
    const rows = document.querySelectorAll<HTMLElement>('[data-slide-id]');
    const first = rows[0],
      second = rows[1];
    if (first === undefined || second === undefined) {
      throw new Error('Missing rows');
    }
    fireEvent.dragStart(second, {dataTransfer: {setData: vi.fn()}});
    fireEvent.drop(first);
    expect(
      document.querySelector('[data-slide-id]')?.getAttribute('data-slide-id'),
    ).toBe(second.dataset.slideId);
    fireEvent.contextMenu(first);
    await userEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    expect(screen.queryByRole('textbox', {name: '내용'})).toBeNull();
  });

  it('saves name, theme and playback together, preserving fresh fields and one control-window undo step', async () => {
    const {content, saved, api, control, original, document: read} = setup();
    await screen.findByRole('textbox', {name: '내용'});
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: '이번 주'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: '내용'}), {
      target: {value: '바뀐 내용'},
    });
    await userEvent.click(screen.getByRole('button', {name: '테마'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '찬양'}));
    await userEvent.click(screen.getByRole('button', {name: '넘기기'}));
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: '15초마다'}),
    );
    await userEvent.click(screen.getByRole('checkbox', {name: '반복'}));
    expect(content).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(content).toHaveBeenCalledOnce();
    expect(read().service.order[0]).toMatchObject({
      theme: '00000000-0000-4000-8000-000000000101',
      slides: {
        name: '이번 주',
        advance: 15,
        loop: false,
        slides: [{text: '바뀐 내용'}, {media: mediaId}],
      },
    });
    expect(serviceOrderEditsFor(control).canUndo(serviceId)).toBe(true);
    await serviceOrderEditsFor(control).undo(serviceId);
    expect(read().service.order).toEqual(original.service.order);
    expect(serviceOrderEditsFor(control).canUndo(serviceId)).toBe(false);
    expect(await pendingWritesOf(api).settleDrafts()).toBe('settled');
  });

  it('guards close and retarget with unsaved changes and keeps the draft after cancel or save failure', async () => {
    const {api, content} = setup();
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '내용',
    });
    fireEvent.change(field, {target: {value: '남은 변경'}});
    let decision: Promise<unknown> = Promise.resolve();
    act(() => {
      decision = pendingWritesOf(api).settleDrafts();
    });
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(await decision).toBe('canceled');
    content.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    expect(await screen.findByText('슬라이드 저장 실패')).toBeTruthy();
    expect(field.value).toBe('남은 변경');
    act(() => {
      decision = pendingWritesOf(api).settleDrafts();
    });
    await userEvent.click(
      await screen.findByRole('button', {name: '저장 안 함'}),
    );
    expect(await decision).toBe('settled');
  });
});
