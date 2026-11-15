import {beforeEach, describe, expect, it} from 'vitest';
import {useShow} from '@renderer/session/showStore';
import {WorkspaceSelections} from '@renderer/session/workspaceSelections';
import {applyService} from '@renderer/session/show';
import {sampleService} from '@fixtures/renderer/session/sampleService';

beforeEach(() => {
  useShow.setState({
    serviceId: 'service',
    rows: [
      {kind: 'header', id: 'first', title: 'First'},
      {kind: 'header', id: 'second', title: 'Second'},
    ],
    openItemId: 'first',
    selectedTile: 2,
    librarySong: null,
    bibleSource: null,
  });
});

describe('workspace selections', () => {
  it('remembers independent selections and slide positions in both directions', () => {
    const selections = new WorkspaceSelections();
    selections.activate('prep');
    expect(useShow.getState().openItemId).toBeNull();
    useShow.setState({openItemId: 'second', selectedTile: 1});
    selections.activate('show');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'first',
      selectedTile: 2,
    });
    useShow.setState({openItemId: 'second', selectedTile: 3});
    selections.activate('prep');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'second',
      selectedTile: 1,
    });
    useShow.setState({openItemId: 'first', selectedTile: 0});
    selections.activate('screens');
    selections.activate('show');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'second',
      selectedTile: 3,
    });
    selections.activate('prep');
    expect(useShow.getState()).toMatchObject({
      openItemId: 'first',
      selectedTile: 0,
    });
  });

  it('does not restore a deleted item or an item from another service', () => {
    const selections = new WorkspaceSelections();
    selections.activate('prep');
    useShow.setState({rows: [{kind: 'header', id: 'second', title: 'Second'}]});
    selections.activate('show');
    expect(useShow.getState().openItemId).toBeNull();
    useShow.setState({openItemId: 'second'});
    selections.activate('prep');
    useShow.setState({serviceId: 'other'});
    selections.activate('show');
    expect(useShow.getState().openItemId).toBeNull();
  });

  it('forgets both selections even if the service switches away and back', () => {
    applyService(sampleService);
    useShow.setState({openItemId: 'song-morning', selectedTile: 1});
    const selections = new WorkspaceSelections();
    selections.activate('prep');
    useShow.setState({openItemId: 'song-river', selectedTile: 2});
    applyService({...sampleService, id: 'copy'});
    expect(useShow.getState()).toMatchObject({
      openItemId: null,
      selectedTile: 0,
    });
    applyService(sampleService);
    selections.activate('show');
    expect(useShow.getState()).toMatchObject({
      openItemId: null,
      selectedTile: 0,
    });
    selections.activate('prep');
    expect(useShow.getState()).toMatchObject({
      openItemId: null,
      selectedTile: 0,
    });
  });
});
