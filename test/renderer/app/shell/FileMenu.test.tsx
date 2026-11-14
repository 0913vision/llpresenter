import {windowCommandLabels} from '@renderer/ui/windowCommandLabels';
import {shortcutCommands} from '@core/shortcuts/registry';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {applyService, useShow} from '@renderer/session/show';
import {createServiceId} from '@core/schema/ids';
import {
  ids,
  librarySongs,
  templateDocument,
  templateEntries,
  titles,
} from '@fixtures/core/serviceList';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {MenuBar} from '@renderer/app/shell/MenuBar';

function setup() {
  const edit = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      value: {id: ids.template, revision: 1},
    }),
  );
  const send = vi.fn();
  window.llp = mockLlpApi({
    templates: {
      list: () => Promise.resolve(templateEntries),
      get: () => Promise.resolve(templateDocument),
    },
    songs: {list: () => Promise.resolve(librarySongs)},
    content: {edit},
    live: {send},
  });
  return {edit, send};
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  applyService(null);
});

afterEach(() => {
  resetTooltips();
  applyService(null);
  delete window.llp;
});

describe('the 파일 menu', () => {
  it.each(['menu', 'shortcut'])(
    'opens the service picker through the %s without changing output',
    async source => {
      const {send} = setup();
      const id = createServiceId('00000000-0000-4000-8000-000000000409');
      const service = {
        id,
        revision: 1,
        name: '저녁 예배',
        readOnly: false,
        rows: [],
        tiles: {},
        jumpKeys: {},
      };
      if (window.llp === undefined) throw new Error('Missing mock API');
      const list = vi.spyOn(window.llp.services, 'list').mockResolvedValue([
        {
          id,
          name: service.name,
          date: '2026-11-09T19:00',
          access: 'editable',
        },
      ]);
      const open = vi
        .spyOn(window.llp.service, 'open')
        .mockResolvedValue(service);
      render(<MenuBar title="" />);
      if (source === 'menu') {
        await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
        const items = screen
          .getAllByRole('menuitem')
          .map(row => row.textContent);
        expect(items[items.indexOf('새 예배') + 1]).toBe('예배 열기…Ctrl O');
        await userEvent.click(
          screen.getByRole('menuitem', {name: /^예배 열기/}),
        );
      } else {
        await userEvent.keyboard('{Control>}o{/Control}');
      }
      expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
      expect(
        await screen.findByRole('menu', {name: '예배 선택'}),
      ).toBeDefined();
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: /저녁 예배/}),
      );
      await waitFor(() => expect(useShow.getState().serviceId).toBe(id));
      expect(list).toHaveBeenCalledOnce();
      expect(open).toHaveBeenCalledExactlyOnceWith({serviceId: id});
      expect(screen.queryByRole('menu')).toBeNull();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('cancels the service picker and returns focus to File', async () => {
    setup();
    render(<MenuBar title="" />);
    await userEvent.keyboard('{Control>}o{/Control}');
    expect(await screen.findByRole('menu', {name: '예배 선택'})).toBeDefined();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', {name: '파일'}),
    );
    expect(useShow.getState().serviceId).toBeNull();
  });

  it('keeps Open Service unavailable outside the app connection', async () => {
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    expect(
      screen
        .getByRole('menuitem', {name: /^예배 열기/})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('opens 새 예배 after closing the menu and keeps the dialog until cancel', async () => {
    const {send} = setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '새 예배'}));
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
    expect(await screen.findByRole('dialog', {name: '새 예배'})).toBeDefined();
    expect(
      await screen.findByRole('treeitem', {name: titles.first}),
    ).toBeDefined();
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('disables importing and saving a template when no service is open', async () => {
    setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    const save = screen.getByRole('menuitem', {
      name: '예배를 템플릿으로 저장…',
    });
    expect(
      shortcutCommands.find(command => command.id === 'service.saveAsTemplate')
        ?.name,
    ).toBe(save.textContent.replace('…', ''));
    expect(save.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    const item = screen.getByRole('menuitem', {name: '다른 예배…'});
    expect(item.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(item);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      (
        await hoverForTooltip(
          screen.getByRole('menuitem', {
            name: '다른 예배…',
          }),
        )
      )?.textContent,
    ).toBe('열린 예배 없음');
  });

  it.each([
    {source: 'file', name: '텍스트 파일'},
    {source: 'clipboard', name: '클립보드 텍스트'},
    {source: 'powerpoint-images', name: 'PowerPoint를 이미지로'},
  ])(
    'mounts the $source import entry and closes both menus',
    async ({source, name}) => {
      setup();
      const onImportText = vi.fn();
      render(
        <MenuBar
          title=""
          onImportText={onImportText}
          clipboardAvailable={async () => true}
        />,
      );
      await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
      await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
      const entry = screen.getByRole('menuitem', {
        name: new RegExp(`^${name}`),
      });
      if (source === 'file') {
        expect(entry.textContent).toContain('Ctrl Shift I');
      }
      await userEvent.click(entry);
      expect(onImportText).toHaveBeenCalledExactlyOnceWith(source);
      expect(screen.queryByRole('menu')).toBeNull();
    },
  );

  it('keeps text imports unavailable until the P5 flow mounts, and PowerPoint unavailable', async () => {
    setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    for (const name of [
      '텍스트 파일',
      '클립보드 텍스트',
      'PowerPoint를 슬라이드로',
      'PowerPoint를 이미지로',
      'PowerPoint를 개체와 글자로',
    ]) {
      expect(
        screen
          .getByRole('menuitem', {name: new RegExp(`^${name}`)})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    }
    expect(
      (
        await hoverForTooltip(
          screen.getByRole('menuitem', {name: /^텍스트 파일/}),
        )
      )?.textContent,
    ).toBe('아직 없는 기능');
  });

  it('imports media into the library once while the request is pending', async () => {
    setup();
    let complete: (() => void) | undefined;
    const importMedia = vi.fn(
      () =>
        new Promise<{ok: true; value: []}>(resolve => {
          complete = () => resolve({ok: true, value: []});
        }),
    );
    const api = window.llp;
    if (!api) throw new Error('Missing API');
    window.llp = mockLlpApi({
      ...api,
      media: {...api.media, import: importMedia},
    });
    render(<MenuBar title="" />);
    const open = (): void => {
      fireEvent.click(screen.getByRole('menuitem', {name: '파일'}));
      fireEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    };
    open();
    fireEvent.click(screen.getByRole('menuitem', {name: '미디어…'}));
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    const row = screen.getByRole('menuitem', {name: '미디어…'});
    expect(row.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(row);
    expect(importMedia).toHaveBeenCalledExactlyOnceWith({
      source: {kind: 'dialog'},
      playlist: null,
    });
    complete?.();
    await waitFor(() => expect(row.getAttribute('aria-disabled')).toBeNull());
  });

  it('reports a refused media import through the shared notification callback', async () => {
    window.llp = mockLlpApi({
      media: {
        import: async () => ({
          ok: false,
          error: {reason: 'invalid', message: 'Invented refusal'},
        }),
      },
    });
    const onProblem = vi.fn();
    render(<MenuBar title="" onProblem={onProblem} />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '미디어…'}));
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '미디어 가져오기 실패'}),
      ),
    );
  });

  it('opens the 환경설정 window from the last row of the menu', async () => {
    const openPreferences = vi.fn();
    setup();
    window.llp = mockLlpApi({window: {openPreferences}});
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(
      screen.getByRole('menuitem', {name: windowCommandLabels.preferences}),
    );

    expect(openPreferences).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
  });
});
