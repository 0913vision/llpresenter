import {afterEach, expect, it, vi} from 'vitest';
import {
  createServiceId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {insertSelectedSong} from '@renderer/session/insertSelectedSong';
import {serviceOrderEditsFor} from '@renderer/session/serviceOrderEdits';
import {useShow} from '@renderer/session/showStore';

afterEach(() => useShow.setState({rows: [], openItemId: null}));

it('inserts a song after an item or at the end of the selected section', async () => {
  const section = createServiceItemId('10000000-0000-4000-8000-000000000001');
  const item = createServiceItemId('10000000-0000-4000-8000-000000000002');
  const next = createServiceItemId('10000000-0000-4000-8000-000000000003');
  const song = createSongId('20000000-0000-4000-8000-000000000001');
  const service = createServiceId('30000000-0000-4000-8000-000000000001');
  const edits = serviceOrderEditsFor(mockLlpApi());
  const insert = vi
    .spyOn(edits, 'insertSong')
    .mockResolvedValue({ok: true, value: true});
  useShow.setState({
    rows: [
      {kind: 'header', id: section, title: 'Section'},
      {kind: 'song', id: item, title: 'Song'},
      {kind: 'header', id: next, title: 'Next'},
    ],
    openItemId: section,
  });
  await insertSelectedSong(edits, service, song);
  expect(insert).toHaveBeenLastCalledWith(service, song, next);
  useShow.setState({openItemId: item});
  await insertSelectedSong(edits, service, song);
  expect(insert).toHaveBeenLastCalledWith(service, song, next);
  useShow.setState({openItemId: null});
  await insertSelectedSong(edits, service, song);
  expect(insert).toHaveBeenLastCalledWith(service, song, null);
});
