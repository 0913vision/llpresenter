import {cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {menuItems} from '@renderer/ui/menuModel';
import {
  stageLayoutsDocument,
  settingsDocument,
  WIDE_LAYOUT_ID,
} from '@renderer/screens/testing/documents';
import {stageLayoutMenuEntries} from './stageLayoutMenu';

afterEach(cleanup);

function layouts() {
  const document = stageLayoutsDocument();
  if (document.name !== 'stage-layouts') throw new Error('Invalid fixture');
  return document.value.layouts;
}

it('lists editing first and every layout in order with the current check', () => {
  const onEdit = vi.fn();
  const onChange = vi.fn();
  const rows = stageLayoutMenuEntries({
    layouts: layouts(),
    value: layouts()[0]?.id,
    onChange,
    onEdit,
  });
  expect(rows.map(row => (row.kind === 'separator' ? '|' : row.label))).toEqual(
    ['선택한 배치 편집…', '|', '현재와 다음', '하단 자막'],
  );
  const items = menuItems(rows);
  expect(items.map(item => item.checked)).toEqual([undefined, true, false]);
  items[0]?.onSelect?.();
  expect(onEdit).toHaveBeenCalledOnce();
  items[2]?.onSelect?.();
  expect(onChange).toHaveBeenCalledExactlyOnceWith(WIDE_LAYOUT_ID);
});

it('draws element frames in layout coordinates without exposing sample output', () => {
  const layout = layouts()[0];
  if (!layout) throw new Error('Missing fixture');
  const document = settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      {
        ...layout,
        elements: [
          {
            id: '00000000-0000-4000-8000-000000000099',
            name: '현재',
            kind: 'currentSlide',
            frame: {x: 40, y: 80, w: 1500, h: 500},
          },
        ],
      },
    ],
  });
  if (document.name !== 'stage-layouts') throw new Error('Invalid fixture');
  const row = menuItems(
    stageLayoutMenuEntries({
      layouts: document.value.layouts,
      value: layout.id,
      onChange: vi.fn(),
      onEdit: undefined,
    }),
  )[1];
  const {container} = render(<>{row?.preview}</>);
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(
    '0 0 1920 1080',
  );
  expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
    'true',
  );
  const frame = container.querySelector('rect');
  expect(
    ['x', 'y', 'width', 'height'].map(name => frame?.getAttribute(name)),
  ).toEqual(['40', '80', '1500', '500']);
});

it('disables editing for a deleted selection and for an unavailable editor', () => {
  for (const input of [
    {value: undefined, onEdit: vi.fn()},
    {value: layouts()[0]?.id, onEdit: undefined},
  ]) {
    const [edit] = menuItems(
      stageLayoutMenuEntries({layouts: layouts(), onChange: vi.fn(), ...input}),
    );
    expect(edit?.disabled).toBe(true);
  }
});
