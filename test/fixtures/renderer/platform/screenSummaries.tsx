import type {ReactNode, JSX} from 'react';
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import {ScreenSummariesContext} from '@renderer/platform/ScreenSummaries';
import type {ScreenSummary} from '@renderer/platform/screens';
import {
  BROADCAST_SCREEN,
  MAIN_SCREEN,
  STAGE_SCREEN,
} from '@fixtures/core/screenIds';

const screens: readonly ScreenSummary[] = [
  {
    id: MAIN_SCREEN,
    icon: 'mplay',
    toolbarLabel: '청중 화면',
    statusLabel: '청중 화면',
    target: '창',
    targetKind: 'window',
    chroma: false,
    kind: 'audience',
  },
  {
    id: STAGE_SCREEN,
    icon: 'mplay',
    toolbarLabel: '무대 화면',
    statusLabel: '무대 화면',
    target: '창',
    targetKind: 'window',
    chroma: false,
    kind: 'stage',
  },
  {
    id: BROADCAST_SCREEN,
    icon: 'capture',
    toolbarLabel: '방송 화면',
    statusLabel: '방송 화면',
    target: '캡처용 창',
    targetKind: 'capture',
    chroma: true,
    kind: 'broadcast',
  },
];

/** Isolates existing view tests from asynchronous settings and render services. */
export function TestScreenSummaries({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <ScreenSummariesContext value={screens}>{children}</ScreenSummariesContext>
  );
}

/** Renders a shell view with deterministic saved-screen summaries. */
export function renderWithScreenSummaries(
  view: ReactNode,
  options?: RenderOptions,
): RenderResult {
  return render(view, {wrapper: TestScreenSummaries, ...options});
}
