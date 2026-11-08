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
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {
  createMediaId,
  createServiceId,
  createServiceItemId,
  createSlideId,
} from '@core/schema/ids';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import type {SlidesItem} from '@core/services/slidesEdits';
import {isItemOfKind} from '@core/schema/service';
import type {BibleProjection} from '@renderer/features/bible/splitProjection';
import {newSlidesItem} from '@core/services/slidesEdits';
import {SlidesEditorHarness} from '@fixtures/renderer/features/service/slides/slidesEditorHarness';
import {ControlSession} from '@renderer/app/controlSession';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {
  recordItemEdit,
  serviceOrderEditsFor,
} from '@renderer/session/serviceOrderEdits';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {useSlidesEditor} from '@renderer/features/service/slides/useSlidesEditor';
import {renderHook} from '@testing-library/react';
import {NotificationStack} from '@renderer/ui/Notification';

vi.mock('@renderer/features/songs/editor/SongPreview', () => ({
  Picture: () => <div />,
}));
const {mockVerseProjection} = vi.hoisted(() => ({
  mockVerseProjection: vi.fn<
    () => Pick<BibleProjection, 'tiles' | 'partsByTile'> | null
  >(() => null),
}));
vi.mock('@renderer/features/bible/useSlidesVerseProjection', () => ({
  useSlidesVerseProjection: () => ({
    projection: mockVerseProjection(),
    failed: false,
  }),
}));
const serviceId = createServiceId('00000000-0000-4000-8000-000000000001');
const itemId = createServiceItemId('00000000-0000-4000-8000-000000000002');
const mediaId = createMediaId('00000000-0000-4000-8000-000000000003');
const slideId = createSlideId('00000000-0000-4000-8000-000000000004');

beforeEach(() => {
  mockVerseProjection.mockReturnValue(null);
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
  const saved = vi.fn<ReturnType<typeof mockLlpApi>['slidesEditor']['saved']>(
    entry => {
      recordItemEdit(api, {
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
  const view = render(<SlidesEditorHarness session={session} />);
  return {
    api,
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

function savedItem(f: ReturnType<typeof setup>): SlidesItem {
  const item = f.document().service.order[0];
  if (item === undefined || !isItemOfKind(item, 'slides')) {
    throw new Error('Missing saved slides');
  }
  return item;
}

describe('automatic inline slides editor', () => {
  it.each(['blank', 'ad'] as const)(
    'saves one transition command across text and media slides in %s, including undo and defaults',
    async form => {
      const f = setup(form);
      const user = userEvent.setup();
      try {
        const controls = within(
          await screen.findByRole('group', {name: '슬라이드 전환'}),
        );
        const rows = [
          ...document.querySelectorAll<HTMLElement>('[data-slide-id]'),
        ];
        if (!rows[0] || !rows[1]) throw new Error('Missing rows');
        fireEvent.click(rows[0]);
        fireEvent.click(rows[1], {shiftKey: true});
        await user.click(controls.getByRole('button', {name: '밀어내기'}));
        await act(async () => {
          await pendingWritesOf(f.api).settleDrafts();
        });
        expect(
          savedItem(f).slides.slides.every(
            slide => slide.transition?.kind === 'push',
          ),
        ).toBe(true);
        expect(
          screen.getAllByRole('img', {name: '개별 전환 설정'}),
        ).toHaveLength(2);
        await user.keyboard('{Control>}z{/Control}');
        await act(async () => {
          await pendingWritesOf(f.api).settleDrafts();
        });
        expect(
          savedItem(f).slides.slides.every(
            slide => slide.transition === undefined,
          ),
        ).toBe(true);
        await user.keyboard('{Control>}y{/Control}');
        await user.click(controls.getByRole('button', {name: '기본값'}));
        await act(async () => {
          await pendingWritesOf(f.api).settleDrafts();
        });
        expect(
          savedItem(f).slides.slides.every(slide => !('transition' in slide)),
        ).toBe(true);
      } finally {
        f.view.unmount();
        await f.session.dispose();
      }
    },
  );
  it('recovers every failed item from the single remaining retry notification', async () => {
    const f = setup('blank');
    f.view.unmount();
    const second = newSlidesItem(
      'ad',
      createServiceItemId('00000000-0000-4000-8000-000000000011'),
    );
    f.replaceDocument({
      ...f.document(),
      service: {...f.document().service, order: [f.item, second]},
    });
    const hook = renderHook(() => useSlidesEditor(f.api, f.session.report));
    try {
      await waitFor(() => expect(hook.result.current.session).not.toBeNull());
      act(() => hook.result.current.close());
      const first = hook.result.current.sessionFor(f.item, {serviceId, itemId});
      const next = hook.result.current.sessionFor(second, {
        serviceId,
        itemId: second.id,
      });
      f.content.mockResolvedValueOnce({
        ok: false,
        error: {reason: 'stale', message: 'First failed'},
      });
      f.content.mockResolvedValueOnce({
        ok: false,
        error: {reason: 'stale', message: 'Second failed'},
      });
      act(() => {
        first.commandSlides({type: 'duplicate'});
        next.commandSlides({type: 'duplicate'});
      });
      await act(async () => {
        expect(await hook.result.current.flush()).toBe(false);
      });
      expect(first.draft.dirty).toBe(true);
      expect(next.draft.dirty).toBe(true);
      expect(first.readOnly).toBe(true);
      expect(next.readOnly).toBe(true);
      expect(await pendingWritesOf(f.api).settleDrafts()).toBe('failed');
      const notices = f.session.getNotices();
      expect(
        notices.filter(notice => notice.key === 'slides-editor'),
      ).toHaveLength(1);
      const notification = render(
        <NotificationStack notices={notices} onClose={f.session.dismiss} />,
      );
      try {
        await userEvent.click(screen.getByRole('button', {name: '다시 시도'}));
        await act(async () => {
          expect(await hook.result.current.flush()).toBe(true);
        });
        expect(first.draft.dirty).toBe(false);
        expect(next.draft.dirty).toBe(false);
        expect(first.readOnly).toBe(false);
        expect(next.readOnly).toBe(false);
        expect(savedItem(f).slides.slides).toHaveLength(3);
        const storedSecond = f
          .document()
          .service.order.find(item => item.id === second.id);
        if (
          storedSecond === undefined ||
          !isItemOfKind(storedSecond, 'slides')
        ) {
          throw new Error('Missing second item');
        }
        expect(storedSecond.slides.slides).toHaveLength(2);
        expect(await pendingWritesOf(f.api).settleDrafts()).toBe('settled');
      } finally {
        notification.unmount();
      }
    } finally {
      hook.unmount();
      await f.session.dispose();
    }
  });
  it.each([
    {form: 'blank' as const, field: '글'},
    {form: 'ad' as const, field: '슬라이드 이름'},
    {form: 'ad' as const, field: '내용'},
  ])(
    'leaves $field editing with Escape, then clears selection and returns to the table',
    async ({form, field}) => {
      const f = setup(form);
      const input = await screen.findByRole<
        HTMLInputElement | HTMLTextAreaElement
      >('textbox', {name: field});
      await userEvent.click(input);
      const text = input.value;
      fireEvent.keyDown(input, {
        key: 'Escape',
        code: 'Escape',
        isComposing: true,
      });
      expect(document.activeElement).toBe(input);
      await userEvent.keyboard('{Escape}');
      expect(input.value).toBe(text);
      expect(document.activeElement).toBe(
        screen.getByRole('group', {name: '슬라이드 편집 명령'}),
      );
      expect(
        document.querySelectorAll('[data-slide-id][data-selected]'),
      ).toHaveLength(1);
      expect(
        document
          .querySelector('[data-slide-id][data-selected]')
          ?.getAttribute('data-slide-id'),
      ).toBe(slideId);
      await userEvent.keyboard('{Escape}');
      expect(
        document.querySelectorAll('[data-slide-id][data-selected]'),
      ).toHaveLength(0);
      expect(screen.queryByRole('textbox', {name: field})).toBeTruthy();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('textbox', {name: field})).toBeNull();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(f.content).not.toHaveBeenCalled();
      f.view.unmount();
      await f.session.dispose();
    },
  );
  it('records writes once with one control API so two successive service undos reach earlier edits', async () => {
    const f = setup('blank');
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '글',
    });
    fireEvent.change(field, {target: {value: 'First change'}});
    await waitFor(() =>
      expect(savedItem(f).slides.slides[0]).toMatchObject({
        text: 'First change',
      }),
    );
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: 'Second change'},
    });
    await waitFor(() => expect(savedItem(f).slides.name).toBe('Second change'));
    const history = serviceOrderEditsFor(f.api);
    await act(async () => {
      expect((await history.undo(serviceId)).ok).toBe(true);
    });
    expect(savedItem(f).slides.name).toBe('빈 슬라이드');
    await act(async () => {
      expect((await history.undo(serviceId)).ok).toBe(true);
    });
    expect(savedItem(f).slides.slides[0]).toMatchObject({text: '첫 내용'});
    expect(f.saved).not.toHaveBeenCalled();
    f.view.unmount();
    await f.session.dispose();
  });

  it('includes a failed cached table-grid session in close preflight even without an open editor', async () => {
    const f = setup('blank');
    f.view.unmount();
    const hook = renderHook(() => useSlidesEditor(f.api, f.session.report));
    await waitFor(() => expect(hook.result.current.session).not.toBeNull());
    act(() => hook.result.current.close());
    const cached = hook.result.current.sessionFor(f.item, {serviceId, itemId});
    f.content.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    act(() => cached.commandSlides({type: 'duplicate'}));
    await act(async () => {
      expect(await hook.result.current.flush()).toBe(false);
    });
    expect(hook.result.current.draft).toBeNull();
    expect(await pendingWritesOf(f.api).settleDrafts()).toBe('failed');
    expect(cached.draft.dirty).toBe(true);
    const retry = f.session
      .getNotices()
      .find(notice => notice.key === 'slides-editor')?.actions?.[0]?.onSelect;
    if (retry === undefined) throw new Error('Missing retry');
    act(() => retry());
    await act(async () => {
      expect(await hook.result.current.flush()).toBe(true);
    });
    expect(await pendingWritesOf(f.api).settleDrafts()).toBe('settled');
    expect(savedItem(f).slides.slides).toHaveLength(3);
    hook.unmount();
    await f.session.dispose();
  });
  it.each(['blank', 'ad'] as const)(
    'saves %s text as typed without disabling focus or offering save/leave questions',
    async form => {
      const f = setup(form);
      const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
        name: form === 'ad' ? '내용' : '글',
      });
      await userEvent.click(field);
      await userEvent.keyboard(' New');
      await waitFor(() =>
        expect(savedItem(f).slides.slides[0]).toMatchObject({
          text: '첫 내용 New',
        }),
      );
      expect(document.activeElement).toBe(field);
      expect(field.disabled).toBe(false);
      expect(screen.queryByRole('button', {name: '저장'})).toBeNull();
      await userEvent.click(screen.getByRole('button', {name: /‹/}));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(
        screen.queryByRole('textbox', {name: form === 'ad' ? '내용' : '글'}),
      ).toBeNull();
      f.view.unmount();
      await f.session.dispose();
    },
  );

  it.each(['Enter', 'Tab'])(
    'keeps back and name in the shared song header and moves %s into text',
    async key => {
      const f = setup('blank');
      const name = await screen.findByRole('textbox', {name: '이름'});
      const header = name.closest('header');
      expect(header).toBeTruthy();
      expect(
        within(header ?? document.body).getByRole('button', {name: /‹/}),
      ).toBeTruthy();
      expect(header?.contains(screen.getByRole('button', {name: '테마'}))).toBe(
        false,
      );
      await userEvent.click(name);
      await userEvent.keyboard(`{${key}}`);
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', {name: '글'}),
      );
      f.view.unmount();
      await f.session.dispose();
    },
  );

  it('keeps one typing undo group across automatic acknowledgements and persists undo/redo', async () => {
    const f = setup('blank');
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '글',
    });
    await userEvent.click(field);
    for (const text of ['First', 'Second', 'Final']) {
      fireEvent.change(field, {target: {value: text}});
      await waitFor(() =>
        expect(savedItem(f).slides.slides[0]).toMatchObject({text}),
      );
    }
    await userEvent.keyboard('{Control>}z{/Control}');
    await waitFor(() =>
      expect(savedItem(f).slides.slides[0]).toMatchObject({text: '첫 내용'}),
    );
    await userEvent.keyboard('{Control>}y{/Control}');
    await waitFor(() =>
      expect(savedItem(f).slides.slides[0]).toMatchObject({text: 'Final'}),
    );
    f.view.unmount();
    await f.session.dispose();
  });

  it('allows more typing and immediate back while a write is in flight, then drains the latest text', async () => {
    const f = setup('blank');
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '글',
    });
    const write = f.content.getMockImplementation();
    if (write === undefined) throw new Error('Missing writer');
    let release = (): void => undefined;
    const paused = new Promise<void>(resolve => {
      release = resolve;
    });
    f.content.mockImplementationOnce(async edit => {
      await paused;
      return write(edit);
    });
    fireEvent.change(field, {target: {value: 'First'}});
    await waitFor(() => expect(f.content).toHaveBeenCalledOnce());
    expect(field.disabled).toBe(false);
    fireEvent.change(field, {target: {value: 'Latest'}});
    await userEvent.click(screen.getByRole('button', {name: /‹/}));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await act(async () => {
      release();
    });
    await waitFor(() =>
      expect(savedItem(f).slides.slides[0]).toMatchObject({text: 'Latest'}),
    );
    expect(await pendingWritesOf(f.api).flush()).toBe(true);
    f.view.unmount();
    await f.session.dispose();
  });

  it('serializes automatic writes to different items and retains their shared histories on reentry', async () => {
    const f = setup('ad');
    f.view.unmount();
    const second = newSlidesItem(
      'blank',
      createServiceItemId('00000000-0000-4000-8000-000000000010'),
    );
    f.replaceDocument({
      ...f.document(),
      service: {...f.document().service, order: [f.item, second]},
    });
    const hook = renderHook(() => useSlidesEditor(f.api, f.session.report));
    await waitFor(() => expect(hook.result.current.session).not.toBeNull());
    const first = hook.result.current.session;
    if (first === null) throw new Error('Missing first session');
    const next = hook.result.current.sessionFor(second, {
      serviceId,
      itemId: second.id,
    });
    act(() => {
      first.commandSlides({type: 'duplicate'});
      next.commandSlides({type: 'duplicate'});
    });
    await act(async () => {
      expect(await hook.result.current.flush()).toBe(true);
    });
    const savedSecond = f
      .document()
      .service.order.find(item => item.id === second.id);
    if (savedSecond === undefined || !isItemOfKind(savedSecond, 'slides')) {
      throw new Error('Missing second item');
    }
    expect(savedSecond.slides.slides).toHaveLength(2);
    expect(first.draft.snapshot.item.slides.slides).toHaveLength(3);
    expect(next.draft.snapshot.item.slides.slides).toHaveLength(2);
    act(() => hook.result.current.requestLeave(() => undefined));
    expect(
      hook.result.current.sessionFor(savedItem(f), {serviceId, itemId}),
    ).toBe(first);
    act(() => first.edit('undo'));
    await act(async () => {
      await hook.result.current.flush();
    });
    expect(savedItem(f).slides.slides).toHaveLength(2);
    hook.unmount();
    await f.session.dispose();
  });

  it('saves header settings and allows the service history to undo them after returning to the table', async () => {
    const f = setup('ad');
    const name = await screen.findByRole('textbox', {name: '이름'});
    fireEvent.change(name, {target: {value: 'Changed title'}});
    await waitFor(() => expect(savedItem(f).slides.name).toBe('Changed title'));
    await userEvent.click(screen.getByRole('button', {name: /‹/}));
    const history = serviceOrderEditsFor(f.api);
    expect(history.canUndo(serviceId)).toBe(true);
    await act(async () => {
      expect((await history.undo(serviceId)).ok).toBe(true);
    });
    expect(savedItem(f).slides.name).toBe('광고');
    f.view.unmount();
    await f.session.dispose();
  });

  it('retains failed edits and offers retry without asking a leave question', async () => {
    const f = setup('blank');
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '글',
    });
    f.content.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed'},
    });
    fireEvent.change(field, {target: {value: 'Retry text'}});
    await screen.findByText('슬라이드 저장 실패');
    expect(await pendingWritesOf(f.api).settleDrafts()).toBe('failed');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', {name: '다시 시도'}));
    await waitFor(() =>
      expect(savedItem(f).slides.slides[0]).toMatchObject({text: 'Retry text'}),
    );
    expect(await pendingWritesOf(f.api).settleDrafts()).toBe('settled');
    f.view.unmount();
    await f.session.dispose();
  });
});
