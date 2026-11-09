import {afterEach, expect, it, vi} from 'vitest';
import {useShow} from '@renderer/session/showStore';
import {selectAddedItem} from '@renderer/session/selectAddedItem';

afterEach(() => {
  useShow.setState({serviceId: null, rows: [], openItemId: null});
  vi.restoreAllMocks();
});

it('selects and reveals a saved item when its service projection arrives', () => {
  const scroll = vi.fn();
  const row = document.createElement('div');
  row.dataset['orderId'] = 'new';
  row.scrollIntoView = scroll;
  document.body.append(row);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    callback(0);
    return 1;
  });
  useShow.setState({
    serviceId: 'service',
    openItemId: 'old',
    rows: [{kind: 'song', id: 'old', title: 'Old'}],
  });
  selectAddedItem('service', 'new', 'old');
  expect(useShow.getState().openItemId).toBe('old');
  useShow.setState({
    rows: [
      {kind: 'song', id: 'old', title: 'Old'},
      {kind: 'song', id: 'new', title: 'New'},
    ],
  });
  expect(useShow.getState().openItemId).toBe('new');
  expect(scroll).toHaveBeenCalledWith({block: 'nearest'});
  row.remove();
});

it('does not steal selection when the operator moves on before the projection', () => {
  useShow.setState({serviceId: 'service', openItemId: 'old', rows: []});
  selectAddedItem('service', 'new', 'old');
  useShow.setState({openItemId: 'other'});
  useShow.setState({rows: [{kind: 'song', id: 'new', title: 'New'}]});
  expect(useShow.getState().openItemId).toBe('other');
});

it('selects an already-projected item when its write reply arrives', () => {
  useShow.setState({
    serviceId: 'service',
    openItemId: 'old',
    rows: [{kind: 'song', id: 'new', title: 'New'}],
  });
  selectAddedItem('service', 'new', 'old');
  expect(useShow.getState().openItemId).toBe('new');
});
