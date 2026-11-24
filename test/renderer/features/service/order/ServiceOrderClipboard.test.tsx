import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {openItem, useShow} from '@renderer/session/show';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {serviceItemClipboardFor} from '@renderer/session/serviceItemClipboard';
import {
  firstId,
  lastId,
  headerId,
  serviceId,
  setup,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';

afterEach(() => {
  delete window.llp;
});

const selectedIds = (): Array<string | null> =>
  screen
    .getAllByRole('option', {selected: true})
    .map(row => row.getAttribute('data-value'));

describe('service order clipboard commands', () => {
  it('waits for an in-flight copy when paste follows before the source read completes', async () => {
    const {api, document, ids} = setup('prep');
    const user = userEvent.setup();
    let finish: ((value: ServiceDocument) => void) | undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await user.click(screen.getByRole('option', {name: '첫 곡'}));
    await user.keyboard('{Control>}c{/Control}');
    await waitFor(() => expect(finish).toBeDefined());
    await user.keyboard('{Control>}v{/Control}');
    expect(api.content.edit).not.toHaveBeenCalled();
    await act(async () => {
      finish?.(document());
    });
    await waitFor(() => expect(ids()).toHaveLength(4));
  });

  it('leaves native copy and paste keys to a row text field', async () => {
    const {api} = setup('prep');
    const user = userEvent.setup();
    fireEvent.contextMenu(screen.getByRole('option', {name: '제목'}));
    await user.click(
      await screen.findByRole('menuitem', {name: '이름 바꾸기'}),
    );
    const field = await screen.findByRole('textbox');
    for (const [key, code] of [
      ['c', 'KeyC'],
      ['v', 'KeyV'],
    ] as const) {
      const event = new KeyboardEvent('keydown', {
        key,
        code,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(false);
      fireEvent.keyUp(field, {key, code, ctrlKey: true});
    }
    expect(serviceItemClipboardFor(api).getCount()).toBe(0);
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it('copies in 진행 but does not change its 예배 순서', async () => {
    const {api, ids} = setup('show');
    const user = userEvent.setup();
    const first = screen.getByRole('option', {name: '첫 곡'});
    await user.click(first);
    first.focus();
    await user.keyboard('{Control>}c{/Control}');
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(1),
    );
    await user.keyboard('{Control>}v{/Control}');
    await user.keyboard('{Control>}d{/Control}');
    await user.keyboard('{Delete}');
    expect(ids()).toEqual([headerId, firstId, lastId]);
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it.each(['prep'] as const)(
    'copies a Shift-selected range and pastes it after the cursor in %s as one undo step',
    async workspace => {
      const {api, ids, send, list} = setup(workspace);
      const user = userEvent.setup();
      const first = screen.getByRole('option', {name: '첫 곡'});
      const last = screen.getByRole('option', {name: '다음 곡'});
      await user.click(first);
      fireEvent.click(last, {shiftKey: true});
      expect(selectedIds()).toEqual([firstId, lastId]);
      last.focus();
      await user.keyboard('{Control>}c{/Control}');
      await waitFor(() =>
        expect(serviceItemClipboardFor(api).getCount()).toBe(2),
      );
      await user.keyboard('{Control>}v{/Control}');
      await waitFor(() => expect(ids()).toHaveLength(5));
      expect(ids().slice(0, 3)).toEqual([headerId, firstId, lastId]);
      await waitFor(() => expect(selectedIds()).toEqual(ids().slice(3)));
      expect(api.content.edit).toHaveBeenCalledOnce();
      expect(send).not.toHaveBeenCalled();
      list().querySelector<HTMLElement>('[tabindex="0"]')?.focus();
      await user.keyboard('{Control>}z{/Control}');
      await waitFor(() => expect(ids()).toEqual([headerId, firstId, lastId]));
      await user.keyboard('{Control>}y{/Control}');
      await waitFor(() => expect(ids()).toHaveLength(5));
      expect(api.content.edit).toHaveBeenCalledTimes(3);
    },
  );

  it('toggles individual rows with Ctrl, extends with Shift arrows and collapses with a plain arrow', async () => {
    setup('prep');
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    const header = screen.getByRole('option', {name: '제목'});
    fireEvent.click(header);
    fireEvent.click(last, {ctrlKey: true});
    expect(selectedIds()).toEqual([headerId, lastId]);
    fireEvent.click(last, {ctrlKey: true});
    expect(selectedIds()).toEqual([headerId]);
    fireEvent.click(first);
    first.focus();
    fireEvent.keyDown(first, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      shiftKey: true,
    });
    expect(selectedIds()).toEqual([firstId, lastId]);
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, {key: 'ArrowUp', code: 'ArrowUp'});
    expect(selectedIds()).toEqual([firstId]);
  });

  it('uses the multi-selection from the context menu and the clicked row as its paste anchor', async () => {
    const {api, ids} = setup('prep');
    const user = userEvent.setup();
    const first = screen.getByRole('option', {name: '첫 곡'});
    const last = screen.getByRole('option', {name: '다음 곡'});
    fireEvent.click(first);
    fireEvent.click(last, {ctrlKey: true});
    fireEvent.contextMenu(first);
    await user.click(await screen.findByRole('menuitem', {name: /^2개 복사/u}));
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(2),
    );
    fireEvent.contextMenu(first);
    await user.click(await screen.findByRole('menuitem', {name: /^붙여넣기/u}));
    await waitFor(() => expect(ids()).toHaveLength(5));
    expect(ids()[0]).toBe(headerId);
    expect(ids()[1]).toBe(firstId);
    expect(ids()[4]).toBe(lastId);
  });

  it('allows copying a read-only source and refuses paste there', async () => {
    const {api, ids} = setup('prep', true);
    const user = userEvent.setup();
    const first = screen.getByRole('option', {name: '첫 곡'});
    fireEvent.contextMenu(first);
    expect(
      screen
        .getByRole('menuitem', {name: /^복사/u})
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
    await user.click(screen.getByRole('menuitem', {name: /^복사/u}));
    await waitFor(() =>
      expect(serviceItemClipboardFor(api).getCount()).toBe(1),
    );
    fireEvent.contextMenu(first);
    expect(
      screen
        .getByRole('menuitem', {name: /^붙여넣기/u})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await user.keyboard('{Escape}');
    first.focus();
    await user.keyboard('{Control>}v{/Control}');
    expect(ids()).toHaveLength(3);
    expect(api.content.edit).not.toHaveBeenCalled();
  });

  it('does not change global selection after the list unmounts during a paste', async () => {
    const {api, view} = setup('prep');
    const user = userEvent.setup();
    await act(async () => {
      await serviceItemClipboardFor(api).copy(serviceId, new Set([firstId]));
    });
    const edit = api.content.edit;
    let finish: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      await new Promise<void>(resolve => {
        finish = resolve;
      });
      return edit(command);
    });
    await user.click(screen.getByRole('option', {name: '첫 곡'}));
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(finish).toBeDefined());
    view.unmount();
    await act(async () => {
      finish?.();
    });
    expect(useShow.getState().openItemId).toBe(firstId);
  });

  it('does not replace the current item selection after the operator changes it while a paste saves', async () => {
    const {api, list} = setup('prep');
    const user = userEvent.setup();
    await act(async () => {
      await serviceItemClipboardFor(api).copy(serviceId, new Set([firstId]));
    });
    const original = api.content.edit;
    let finish: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async command => {
      await new Promise<void>(resolve => {
        finish = resolve;
      });
      return original(command);
    });
    fireEvent.click(screen.getByRole('option', {name: '첫 곡'}));
    list().querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    await user.keyboard('{Control>}v{/Control}');
    await waitFor(() => expect(finish).toBeDefined());
    act(() => openItem(lastId));
    await act(async () => {
      finish?.();
    });
    expect(useShow.getState().openItemId).toBe(lastId);
  });
});
