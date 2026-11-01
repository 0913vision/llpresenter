import {onTestFinished, vi} from 'vitest';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';

/** Builds the existing session fixture with its mock clock and held writes. */
export function setup() {
  vi.useFakeTimers();
  const fixture = editorFixture();
  const store = new SongEditorStore(fixture.api, vi.fn());
  store.open(fixture.first);
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('Missing session');
  const held: Array<() => void> = [];
  onTestFinished(async () => {
    for (const release of held) release();
    await store.dispose();
    vi.useRealTimers();
  });
  const text = (value: string): void =>
    session.edit({
      type: 'text',
      text: value,
      start: value.length,
      end: value.length,
    });
  const holdWrite = () => {
    const write = fixture.api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(fixture.api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
        held.push(release);
      });
    });
    return () => release();
  };
  return {...fixture, store, session, text, holdWrite};
}
