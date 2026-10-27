import {describe, expect, it, vi} from 'vitest';
import type {SettingsEdit} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {settingsDocument, LAYOUT_ID} from '../testing/documents';
import {
  StageEditor,
  STAGE_ELEMENT_LIMIT,
  STAGE_LAYOUT_LIMIT,
} from './stageEditor';

function setup(
  access: 'editable' | 'readOnly' = 'editable',
  count = 1,
  elements = 1,
) {
  const item = {
    id: 'element',
    kind: 'currentSlide',
    name: 'Current',
    frame: {x: 10, y: 20, w: 100, h: 80, future: 1},
    future: 'keep',
  };
  const value = settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    future: 'file',
    layouts: Array.from({length: count}, (_, index) => ({
      id:
        index === 0
          ? LAYOUT_ID
          : `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: index === 0 ? '새 배치' : `Layout ${index}`,
      width: 1920,
      height: 1080,
      future: 'layout',
      elements: Array.from({length: elements}, (_, i) => ({
        ...item,
        id: i === 0 ? 'element' : `element-${i}`,
      })),
    })),
  });
  if (value.name !== 'stage-layouts') throw new Error('Expected stage layouts');
  const edits: Array<Extract<SettingsEdit, {name: 'stage-layouts'}>> = [];
  const log = vi.fn(),
    report = vi.fn();
  const api = fakeLlpApi({
    settings: {
      edit: edit => {
        if (edit.name !== 'stage-layouts') {
          throw new Error('Unexpected document');
        }
        edits.push(edit);
        return Promise.resolve({
          ok: true,
          value: {id: 'stage-layouts', revision: edits.length + 1},
        });
      },
    },
    log: {write: log},
  });
  const editor = new StageEditor(api, report);
  editor.adopt({...value, access});
  return {editor, edits, value, report, log};
}
describe('stage document edits', () => {
  it('queues nudges against the latest revision and retains unknown fields', async () => {
    const {editor, edits} = setup();
    await Promise.all([
      editor.nudge(LAYOUT_ID, 'element', {x: 1, y: 0}),
      editor.nudge(LAYOUT_ID, 'element', {x: 10, y: 0}),
    ]);
    expect(edits.map(edit => edit.baseRevision)).toEqual([1, 2]);
    const last = edits.at(-1);
    expect(last?.name === 'stage-layouts' && last.value).toMatchObject({
      future: 'file',
      layouts: [
        {
          future: 'layout',
          elements: [{future: 'keep', frame: {x: 21, future: 1}}],
        },
      ],
    });
  });
  it('creates an empty uniquely named layout and saves an added element then removes it', async () => {
    const {editor, edits} = setup();
    const layout = await editor.create();
    expect(
      edits[0]?.name === 'stage-layouts' && edits[0].value.layouts.at(-1),
    ).toMatchObject({
      name: '새 배치 2',
      width: 1920,
      height: 1080,
      elements: [],
    });
    if (layout === null) throw new Error('Missing layout');
    const element = await editor.add(layout, 'nextSlide');
    expect(
      edits[1]?.name === 'stage-layouts' &&
        edits[1].value.layouts.at(-1)?.elements[0],
    ).toMatchObject({
      kind: 'nextSlide',
      frame: {x: 45, y: 100, w: 1194, h: 260},
      text: {
        font: 'Pretendard',
        vAlign: 'top',
        size: 72,
        align: 'left',
        lineHeight: 1.3,
        autoFit: true,
      },
    });
    if (element === null) throw new Error('Missing element');
    await editor.frame(layout, element, {x: -10, y: 10, w: 200, h: 90});
    await editor.remove(layout, element);
    expect(edits.at(-1)?.value.layouts.at(-1)?.elements).toEqual([]);
  });
  it('queues individual reference-pixel fields without overwriting other queued axes', async () => {
    const {editor, edits} = setup();
    await Promise.all([
      editor.frameValue(LAYOUT_ID, 'element', {field: 'x', value: 240}),
      editor.frameValue(LAYOUT_ID, 'element', {field: 'y', value: 360}),
      editor.frameValue(LAYOUT_ID, 'element', {field: 'w', value: 600}),
      editor.frameValue(LAYOUT_ID, 'element', {field: 'h', value: 120}),
    ]);
    expect(edits.map(edit => edit.baseRevision)).toEqual([1, 2, 3, 4]);
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]).toMatchObject({
      future: 'keep',
      frame: {x: 240, y: 360, w: 600, h: 120, future: 1},
    });
  });
  it('bounds numeric geometry to the canvas and refuses invalid or unchanged values', async () => {
    const {editor, edits} = setup();
    expect(
      await editor.frameValue(LAYOUT_ID, 'element', {field: 'x', value: 10}),
    ).toMatchObject({x: 10, y: 20});
    expect(
      await editor.frameValue(LAYOUT_ID, 'element', {field: 'w', value: NaN}),
    ).toBeNull();
    expect(
      await editor.frameValue(LAYOUT_ID, 'element', {
        field: 'h',
        value: Infinity,
      }),
    ).toBeNull();
    expect(
      await editor.frameValue(LAYOUT_ID, 'missing', {field: 'x', value: 20}),
    ).toBeNull();
    expect(edits).toHaveLength(0);
    await editor.frameValue(LAYOUT_ID, 'element', {field: 'x', value: -50});
    await editor.frameValue(LAYOUT_ID, 'element', {field: 'y', value: 9000});
    await editor.frameValue(LAYOUT_ID, 'element', {field: 'w', value: 1});
    await editor.frameValue(LAYOUT_ID, 'element', {field: 'h', value: 9000});
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]?.frame).toMatchObject({
      x: 0,
      y: 1080,
      w: 20,
      h: 1080,
      future: 1,
    });
    await editor.frameValue(LAYOUT_ID, 'element', {field: 'w', value: 31.7});
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]?.frame.w).toBe(32);
    const locked = setup('readOnly');
    expect(
      await locked.editor.frameValue(LAYOUT_ID, 'element', {
        field: 'x',
        value: 20,
      }),
    ).toBeNull();
    expect(locked.edits).toHaveLength(0);
  });
  it('couples ratio edits using the newest queued frame and preserves the origin', async () => {
    const {editor, edits} = setup();
    const frames = await Promise.all([
      editor.frameValue(LAYOUT_ID, 'element', {
        field: 'w',
        value: 200,
        keepRatio: true,
      }),
      editor.frameValue(LAYOUT_ID, 'element', {
        field: 'h',
        value: 240,
        keepRatio: true,
      }),
    ]);
    expect(frames).toMatchObject([
      {x: 10, y: 20, w: 200, h: 160, future: 1},
      {x: 10, y: 20, w: 300, h: 240, future: 1},
    ]);
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]?.frame).toMatchObject({
      w: 300,
      h: 240,
    });
  });
  it('refuses writes to future-version documents and enforces both collection caps', async () => {
    const readOnly = setup('readOnly');
    expect(await readOnly.editor.add(LAYOUT_ID, 'clock')).toBeNull();
    expect(readOnly.edits).toEqual([]);
    expect(
      await setup('editable', STAGE_LAYOUT_LIMIT, 0).editor.create(),
    ).toBeNull();
    expect(
      await setup('editable', 1, STAGE_ELEMENT_LIMIT).editor.add(
        LAYOUT_ID,
        'clock',
      ),
    ).toBeNull();
  });
});
