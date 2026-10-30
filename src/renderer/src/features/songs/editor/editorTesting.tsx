import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, onTestFinished, vi} from 'vitest';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import type {Notice} from '@renderer/ui/notices';
import {editorFixture} from './editorFixture';
import {SongEditor} from './SongEditor';
import {SongEditorStore} from './songEditorStore';

export async function editorSetup(fixture = editorFixture()) {
  resetTooltips();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const onProblem = vi.fn<(notice: Notice) => void>();
  const store = new SongEditorStore(fixture.api, onProblem);
  store.open(fixture.first);
  const view = render(
    <>
      <button type="button">다음 패널</button>
      <SongEditor store={store} />
    </>,
  );
  onTestFinished(async () => {
    view.unmount();
    await store.dispose();
  });
  await waitFor(() => expect(store.getSnapshot().labels).not.toBeNull());
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing session');
  return {...fixture, store, session, user: userEvent.setup(), view, onProblem};
}

export function lyrics(number = 1): HTMLTextAreaElement {
  const input = screen.getByRole('textbox', {name: `슬라이드 ${number} 가사`});
  if (!(input instanceof HTMLTextAreaElement)) throw new Error('No lyrics');
  return input;
}

/** Supplies the inherited menu row token that jsdom does not resolve. */
export function mockMenuRowHeight(): void {
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
    const style = computedStyle(element);
    const property = style.getPropertyValue.bind(style);
    vi.spyOn(style, 'getPropertyValue').mockImplementation(name =>
      name === '--size-row-menu' ? '28px' : property(name),
    );
    return style;
  });
}
