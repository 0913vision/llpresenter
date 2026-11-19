import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ItemEditorAddBar} from '@renderer/platform/ItemEditorAddBar';
import {editorCapabilities} from '@renderer/platform/itemEditorAdapter';

describe('item editor add bar', () => {
  it.each([
    ['song', ['slide', 'title']],
    ['blank', ['slide', 'picture', 'verse', 'title']],
    ['ad', ['slide', 'picture', 'title']],
    ['bible', ['title']],
    ['sermon', []],
    ['liturgy', []],
    ['media', []],
  ] as const)(
    '%s shows only supported commands in one footer',
    (kind, names) => {
      const {container} = render(
        <ItemEditorAddBar
          adapter={editorCapabilities(kind)}
          count={2}
          slide={<button>slide</button>}
          picture={<button>picture</button>}
          verse={<button>verse</button>}
          title={<button>title</button>}
        />,
      );
      const footer = container.querySelector('footer');
      if (footer === null) throw Error('Missing editor footer');
      expect(
        within(footer)
          .queryAllByRole('button')
          .map(button => button.textContent),
      ).toEqual(names);
      expect(screen.getByText('2개')).toBeDefined();
    },
  );
});
