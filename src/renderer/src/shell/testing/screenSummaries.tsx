import type {ReactNode, JSX} from 'react';
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import {ScreenSummariesContext} from '../ScreenSummaries';
import type {ScreenSummary} from '../screens';

const screens: readonly ScreenSummary[] = [
  {
    id: 'main',
    icon: 'mplay',
    toolbarLabel: '본 화면',
    statusLabel: '본 화면',
    target: '창',
    targetKind: 'window',
    chroma: false,
  },
  {
    id: 'stage',
    icon: 'mplay',
    toolbarLabel: '무대',
    statusLabel: '무대 화면',
    target: '창',
    targetKind: 'window',
    chroma: false,
  },
  {
    id: 'broadcast',
    icon: 'capture',
    toolbarLabel: '방송 자막',
    statusLabel: '방송 자막',
    target: '캡처용 창',
    targetKind: 'capture',
    chroma: true,
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
