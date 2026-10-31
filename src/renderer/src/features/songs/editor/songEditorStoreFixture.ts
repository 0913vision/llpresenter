import type {Notice} from '@renderer/ui/notices';
import {onTestFinished, vi} from 'vitest';
import {editorFixture} from './editorFixture';
import {SongEditorStore} from './songEditorStore';

/** Builds the existing isolated editor fixture and registers its close cleanup. */
export function setup() {
  const fixture = editorFixture();
  const problem = vi.fn<(notice: Notice) => void>();
  const store = new SongEditorStore(fixture.api, problem);
  store.open(fixture.first);
  onTestFinished(() => store.dispose());
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('No editor session');
  const text = (value: string) =>
    session.edit({
      type: 'text',
      text: value,
      start: value.length,
      end: value.length,
    });
  return {...fixture, store, session, text, problem};
}
