import {describe, expect, it} from 'vitest';
import {contextMenuEntries} from '@renderer/ui/contextMenuEntries';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import {menuAvailability, type MenuEntry} from '@renderer/ui/menuModel';

describe('context commands', () => {
  it('orders style clipboard commands after paste and unknown commands last', () => {
    const result = contextMenuEntries([
      {kind: 'item', id: 'unknown', label: 'Other', contextGroup: 'clipboard'},
      laterRow('paste-style', 'Paste style'),
      {kind: 'item', id: 'cut', label: 'Cut', contextGroup: 'clipboard'},
      {kind: 'item', id: 'undo', label: 'Undo', contextGroup: 'clipboard'},
      laterRow('copy-style', 'Copy style'),
      {kind: 'item', id: 'paste', label: 'Paste', contextGroup: 'clipboard'},
    ]);
    expect(result.map(row => row.id)).toEqual([
      'undo',
      'cut',
      'paste',
      'copy-style',
      'paste-style',
      'unknown',
    ]);
  });
  it('orders the populated groups and keeps a real disabled command with its reason', () => {
    const entries: readonly MenuEntry[] = [
      {kind: 'item', id: 'delete', label: 'Delete', contextGroup: 'delete'},
      menuSeparator('old'),
      laterRow('hide', 'Hide'),
      {
        kind: 'item',
        id: 'paste',
        label: 'Paste',
        contextGroup: 'clipboard',
        ...menuAvailability('Clipboard is empty'),
      },
      {kind: 'item', id: 'copy', label: 'Copy', contextGroup: 'clipboard'},
      {kind: 'item', id: 'memo', label: 'Memo', contextGroup: 'memo'},
      {kind: 'item', id: 'theme', label: 'Theme'},
      {kind: 'item', id: 'edit', label: 'Edit', contextGroup: 'default'},
      {
        kind: 'item',
        id: 'reload-from-library',
        label: 'Reload',
        contextGroup: 'library',
      },
      {
        kind: 'item',
        id: 'show-in-library',
        label: 'Reveal',
        contextGroup: 'library',
      },
    ];
    const result = contextMenuEntries(entries);
    expect(result.map(row => row.id)).toEqual([
      'edit',
      'context:settings',
      'theme',
      'context:memo',
      'memo',
      'context:clipboard',
      'copy',
      'paste',
      'context:library',
      'show-in-library',
      'reload-from-library',
      'context:hide',
      'hide',
      'context:delete',
      'delete',
    ]);
    expect(result.find(row => row.id === 'paste')).toMatchObject({
      disabled: true,
      title: 'Clipboard is empty',
    });
  });
  it('keeps future rows and nested placeholders while removing empty parents and unused separators', () => {
    const result = contextMenuEntries([
      menuSeparator('start'),
      laterRow('future', 'Future'),
      laterRow('future-submenu', 'Future submenu', {submenu: true}),
      {
        kind: 'item',
        id: 'empty',
        label: 'Empty',
        submenu: [],
      },
      {
        kind: 'item',
        id: 'parent',
        label: 'Parent',
        submenu: [
          menuSeparator('start'),
          laterRow('future2', 'Future'),
          {kind: 'item', id: 'real', label: 'Real'},
          menuSeparator('end'),
        ],
      },
      menuSeparator('end'),
    ]);
    expect(result.map(row => row.id)).toEqual([
      'future',
      'future-submenu',
      'parent',
    ]);
    expect(result[0]).toMatchObject({disabled: true, title: '아직 없는 기능'});
    expect(result[1]).toMatchObject({
      disabled: true,
      title: '아직 없는 기능',
      submenu: [],
    });
    expect(result[2]).toMatchObject({
      id: 'parent',
      submenu: [
        {id: 'future2', disabled: true, title: '아직 없는 기능'},
        {id: 'real'},
      ],
    });
    expect(contextMenuEntries([laterRow('only', 'Only')])).toHaveLength(1);
  });
});
