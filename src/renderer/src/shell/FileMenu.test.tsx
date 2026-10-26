import {render, screen, waitFor} from '@testing-library/react';
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
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('dialog', {name: '새 예배'})).toBeDefined();
    expect(screen.queryByRole('menu', {name: '파일'})).toBeNull();
  });

  it('disables importing and saving a template when no service is open', async () => {
    setup();
    render(<MenuBar title="" />);
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    for (const name of ['다른 예배에서 가져오기', '지금 예배를 틀로 저장']) {
      const item = screen.getByRole('menuitem', {name});
      expect(item.getAttribute('aria-disabled')).toBe('true');
      await userEvent.click(item);
      expect(screen.queryByRole('dialog')).toBeNull();
    }
    expect(
      (
        await hoverForTooltip(
          screen.getByRole('menuitem', {
            name: '다른 예배에서 가져오기',
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
    await userEvent.click(
      screen.getByRole('menuitem', {name: '다른 예배에서 가져오기'}),
    );
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
      screen.getByRole('menuitem', {name: '지금 예배를 틀로 저장'}),
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
    for (const name of ['텍스트 파일', '클립보드 텍스트', 'PowerPoint 파일']) {
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
});
