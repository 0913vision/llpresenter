import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {applyService} from '@renderer/state/show';
import {sampleService} from '@renderer/show/testing/sampleService';
import {
  ids,
  librarySongs,
  templateDocument,
  templateEntries,
  titles,
} from '@renderer/prep/services/testing';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {MenuBar} from './MenuBar';

function setup() {
  const edit = vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      value: {id: ids.template, revision: 1},
    }),
  );
  const send = vi.fn();
  window.llp = fakeLlpApi({
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
  it('opens 새 예배 after closing the menu and keeps the dialog until cancel', async () => {
    const {send} = setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '새 예배'}));
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
    expect(screen.getByRole('dialog', {name: '새 예배'})).toBeDefined();
    expect(
      await screen.findByRole('treeitem', {name: titles.first}),
    ).toBeDefined();
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('opens 새 예배 with the keyboard', async () => {
    setup();
    render(<MenuBar title="" />);
    screen.getByRole('menuitem', {name: '파일'}).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByRole('dialog', {name: '새 예배'})).toBeDefined();
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
  });

  it('disables importing and saving a template when no service is open', async () => {
    setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    const save = screen.getByRole('menuitem', {
      name: '예배를 템플릿으로 저장…',
    });
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
    ).toBe('열린 예배 순서가 없습니다');
  });

  it('imports checked items through the existing service dialog', async () => {
    const {edit, send} = setup();
    applyService({...sampleService, id: ids.past});
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '다른 예배…'}));
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
    await userEvent.click(
      await screen.findByRole('treeitem', {name: titles.first}),
    );
    await userEvent.click(screen.getByRole('button', {name: '가져오기'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      type: 'service.importItems',
      serviceId: ids.past,
      from: {kind: 'template', id: ids.template},
      itemIds: [ids.doxology],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('saves the open service as a template through the shared action', async () => {
    const {edit, send} = setup();
    applyService({...sampleService, id: ids.past, name: '저녁 예배'});
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(
      screen.getByRole('menuitem', {name: '예배를 템플릿으로 저장…'}),
    );
    await waitFor(() =>
      expect(edit).toHaveBeenCalledExactlyOnceWith({
        type: 'service.saveAsTemplate',
        serviceId: ids.past,
        name: '저녁 예배',
      }),
    );
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    {source: 'file', name: '텍스트 파일'},
    {source: 'clipboard', name: '클립보드 텍스트'},
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
      'PowerPoint를 그림으로',
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
    ).toBe('텍스트 가져오기를 준비 중입니다');
  });

  it('lists the File and Import menu rows and separators in spec order', async () => {
    setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    const rows = (menu: HTMLElement): Array<string | null> =>
      [...menu.querySelectorAll('[role=menuitem], [role=separator]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      );
    expect(rows(screen.getByRole('menu', {name: '파일'}))).toEqual([
      '새 곡',
      '새 예배',
      '새 라이브러리',
      '가져오기',
      '|',
      '내보내기',
      '예배를 템플릿으로 저장…',
      '|',
      '인쇄…',
    ]);
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    expect(rows(screen.getByRole('menu', {name: '가져오기'}))).toEqual([
      '텍스트 파일…Ctrl Shift I',
      '라이브러리…',
      '미디어…',
      '클립보드 텍스트…',
      '다른 예배…',
      '|',
      'MultiTracks…',
      'SongSelect…',
      '|',
      'PowerPoint를 슬라이드로…',
      'PowerPoint를 그림으로…',
      'PowerPoint를 개체와 글자로…',
    ]);
    for (const name of ['라이브러리…', 'MultiTracks…', 'SongSelect…']) {
      expect(
        screen.getByRole('menuitem', {name}).getAttribute('aria-disabled'),
      ).toBe('true');
    }
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
    window.llp = fakeLlpApi({
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
    window.llp = fakeLlpApi({
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
        expect.objectContaining({title: '미디어를 가져올 수 없음'}),
      ),
    );
  });
});
