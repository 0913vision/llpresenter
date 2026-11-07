import {act, renderHook} from '@testing-library/react';
import {isValidElement, type ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {bibleSource} from '@core/bible/source';
import {panelPassage} from '@fixtures/contracts/ipc/bibleApi';
import {
  SERVICE_ORDER,
  serviceOrderParts,
} from '@renderer/app/workspaces/serviceOrderPanel';
import {useShowPanels} from '@renderer/app/workspaces/showPanels';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {useShow} from '@renderer/session/show';
import type {SizeClass} from '@renderer/ui/sizeClass';

vi.mock('@renderer/features/presentation/BiblePanel', () => ({
  BiblePanel: () => null,
}));
vi.mock('@renderer/features/quick/QuickPanel', () => ({
  QuickPanel: () => null,
}));
vi.mock('@renderer/app/workspaces/serviceOrderPanel', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@renderer/app/workspaces/serviceOrderPanel')
  >()),
  serviceOrderParts: vi.fn(() => ({})),
}));

function panels(sizeClass: SizeClass = 'normal') {
  return renderHook(() =>
    useShowPanels({
      active: true,
      sizeClass,
      onProblem: undefined,
      onOpenPrep: undefined,
      onShowInLibrary: undefined,
      sidebarAction: null,
    }),
  ).result;
}

function propsOf(node: ReactNode): Record<string, unknown> | null {
  return isValidElement<Record<string, unknown>>(node) ? node.props : null;
}

beforeEach(() => {
  useShow.setState({bibleSource: null, openItemId: null});
});

describe('useShowPanels', () => {
  it.each(['narrow', 'normal', 'wide'] as const)(
    'puts the Bible panel in the slide column at the %s size while a passage is open',
    sizeClass => {
      const source = bibleSource(panelPassage());
      useShow.setState({bibleSource: source, openItemId: source.id});

      const slides = panels(sizeClass).current.partsOf('슬라이드').embedded;

      expect(isValidElement(slides) && slides.type).toBe(BiblePanel);
      expect(propsOf(slides)?.['sizeClass']).toBe(sizeClass);
    },
  );

  it('gives the quick panel a new selection version each time a service row opens', () => {
    const result = panels();
    const version = () =>
      propsOf(result.current.partsOf('퀵 실행').embedded)?.['selectionVersion'];
    expect(version()).toBe(0);

    result.current.partsOf(SERVICE_ORDER);
    const onOpenItem =
      vi.mocked(serviceOrderParts).mock.lastCall?.[0].onOpenItem;
    act(() => onOpenItem?.());

    expect(version()).toBe(1);
  });

  it('lets the 미리보기 picture shrink before the 진행 도구 panel does', () => {
    expect(panels().current.partsOf('미리보기').size).toBe('fit');
    expect(panels().current.partsOf('진행 도구').size).toBe('rest');
  });
});
