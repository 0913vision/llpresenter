import type {SongSession} from './songSession';

export function songEditorSourceId(session: SongSession): string {
  const {id} = session.history.snapshot.song;
  return session.itemSession ? id : `library:${id}`;
}
