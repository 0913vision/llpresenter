import {render, within} from '@testing-library/react';
import {expect, it} from 'vitest';
import {ItemEditorShell} from '@renderer/platform/ItemEditorShell';
import {ItemEditorAddBar} from '@renderer/platform/ItemEditorAddBar';
import {editorCapabilities} from '@renderer/platform/itemEditorAdapter';

it('keeps the common add bar after the editor content', () => {
  const {getByRole} = render(
    <ItemEditorShell
      label="Editor"
      className="editor"
      header={<div>Editor header</div>}
      footer={
        <ItemEditorAddBar
          adapter={editorCapabilities('bible')}
          count={3}
          title={<button>Title</button>}
        />
      }
    >
      <div>Slide content</div>
    </ItemEditorShell>,
  );
  const editor = getByRole('region', {name: 'Editor'});
  expect(editor.firstElementChild?.textContent).toBe('Editor header');
  expect(editor.children[1]?.textContent).toBe('Slide content');
  expect(editor.lastElementChild?.tagName).toBe('FOOTER');
  expect(within(editor).getByRole('button', {name: 'Title'})).toBeDefined();
});
