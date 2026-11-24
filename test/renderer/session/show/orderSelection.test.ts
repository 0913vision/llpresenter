import {beforeEach, expect, it} from 'vitest';
import {orderSelectionId} from '@renderer/session/show/orderSelection';
import {useShow} from '@renderer/session/show/showStore';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';

beforeEach(() => {
  seedSampleService();
});

it('is the open item while it is a row of the 예배 순서', () => {
  useShow.setState({openItemId: 'song-river'});
  expect(orderSelectionId()).toBe('song-river');
});

it('keeps the row chosen last while a library song or a passage is open', () => {
  useShow.setState({openItemId: 'song-morning'});
  useShow.setState({openItemId: 'library:song-1'});
  expect(orderSelectionId()).toBe('song-morning');
});

it('forgets the row when another service opens', () => {
  useShow.setState({openItemId: 'song-morning'});
  useShow.setState(view => ({
    openItemId: 'library:song-1',
    serviceEpoch: view.serviceEpoch + 1,
  }));
  expect(orderSelectionId()).toBeNull();
});

it('is none when nothing is open, so new items go to the end', () => {
  useShow.setState({openItemId: 'song-morning'});
  useShow.setState({openItemId: null});
  expect(orderSelectionId()).toBeNull();
});
