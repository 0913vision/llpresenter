import {settingsDocument} from '@core/testing/settingsDocument';
import {describe, expect, it, vi} from 'vitest';
import type {SettingsEdit} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {LAYOUT_ID} from '@core/testing/screenDocuments';
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
    box: {opacity: 0.375, future: 'box'},
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
  const api = mockLlpApi({
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
  return {editor, edits, value, report, log, api};
}
describe('stage document edits', () => {
  it('persists an already-applied layout rename before accepting its retry', async () => {
    const {editor, api} = setup();
    const edit = vi
      .spyOn(api.settings, 'edit')
      .mockResolvedValueOnce({
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Invented disk failure',
          applied: {id: 'stage-layouts', revision: 2},
          unchangedFiles: ['stage.json'],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {id: 'stage-layouts', revision: 3},
      });
    expect(await editor.renameLayout(LAYOUT_ID, 'Renamed')).toBe(false);
    expect(await editor.renameLayout(LAYOUT_ID, 'Renamed')).toBe(true);
    expect(edit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({baseRevision: 2}),
    );
  });
  it('removes a layout against the newest queued document and returns its neighbour', async () => {
    const {editor, edits, value} = setup('editable', 2);
    const second = value.value.layouts[1]?.id;
    if (second === undefined) throw new Error('Missing second layout');
    const [removed, renamed] = await Promise.all([
      editor.removeLayout(LAYOUT_ID),
      editor.renameLayout(second, 'Renamed'),
    ]);
    expect(removed).toEqual({next: second});
    expect(renamed).toBe(true);
    expect(edits.map(edit => edit.baseRevision)).toEqual([1, 2]);
    expect(edits.at(-1)?.value).toMatchObject({
      future: 'file',
      layouts: [{id: second, name: 'Renamed', future: 'layout'}],
    });
    expect(await editor.removeLayout('missing')).toBeNull();
    expect(await editor.removeLayout(second)).toEqual({next: null});
    const readOnly = setup('readOnly');
    expect(await readOnly.editor.removeLayout(LAYOUT_ID)).toBeNull();
    expect(readOnly.edits).toEqual([]);
  });
  it('duplicates layouts with unique names and preserves fields without sharing edits', async () => {
    const {editor, edits, value} = setup();
    const copied = await editor.duplicate(LAYOUT_ID);
    if (copied === null) throw new Error('Missing copy');
    const copy = edits.at(-1)?.value.layouts.at(-1);
    expect(copied).not.toBe(LAYOUT_ID);
    expect(copy).toMatchObject({
      name: '새 배치 복사본',
      width: 1920,
      height: 1080,
      future: 'layout',
    });
    expect(copy?.elements).toEqual(value.value.layouts[0]?.elements);
    await editor.frame(copied, 'element', {x: 500, y: 20, w: 100, h: 80});
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]?.frame.x).toBe(10);
    expect(edits.at(-1)?.value.layouts[1]?.elements[0]?.frame.x).toBe(500);
  });
  it('checks copy names and conflicting renames against the newest queued document', async () => {
    const {editor, edits, report} = setup();
    const copies = await Promise.all([
      editor.duplicate(LAYOUT_ID),
      editor.duplicate(LAYOUT_ID),
    ]);
    expect(edits.at(-1)?.value.layouts.map(layout => layout.name)).toEqual([
      '새 배치',
      '새 배치 복사본',
      '새 배치 복사본 2',
    ]);
    const copied = copies[0];
    if (copied === null) {
      throw new Error('Missing copy');
    }
    expect(
      await Promise.all([
        editor.renameLayout(LAYOUT_ID, 'Shared'),
        editor.renameLayout(copied, ' Shared '),
      ]),
    ).toEqual([true, false]);
    expect(edits.map(edit => edit.baseRevision)).toEqual([1, 2, 3]);
    expect(report).toHaveBeenCalledWith('invalid stage layout name');
    expect(edits.at(-1)?.value.layouts[1]?.name).toBe('새 배치 복사본');
  });
  it('trims names, skips unchanged or missing layouts, and refuses invalid names and copies', async () => {
    const {editor, edits} = setup();
    expect(await editor.renameLayout(LAYOUT_ID, '  Renamed  ')).toBe(true);
    expect(edits.at(-1)?.value.layouts[0]).toMatchObject({
      name: 'Renamed',
      future: 'layout',
    });
    expect(await editor.renameLayout(LAYOUT_ID, 'Renamed')).toBe(true);
    expect(await editor.renameLayout(LAYOUT_ID, ' ')).toBe(false);
    expect(await editor.renameLayout('missing', 'Name')).toBe(false);
    expect(await editor.duplicate('missing')).toBeNull();
    expect(edits).toHaveLength(1);
    const full = setup('editable', STAGE_LAYOUT_LIMIT, 0);
    expect(await full.editor.duplicate(LAYOUT_ID)).toBeNull();
    expect(full.edits).toHaveLength(0);
    const readOnly = setup('readOnly');
    expect(await readOnly.editor.duplicate(LAYOUT_ID)).toBeNull();
    expect(await readOnly.editor.renameLayout(LAYOUT_ID, 'Name')).toBe(false);
    expect(readOnly.edits).toHaveLength(0);
  });
  it('queues clock format patches without replacing other element fields', async () => {
    const {editor, edits} = setup();
    await Promise.all([
      editor.patch(LAYOUT_ID, 'element', {kind: 'clock', clockFormat: '12h'}),
      editor.patch(LAYOUT_ID, 'element', {name: 'Renamed clock'}),
    ]);
    expect(edits.map(edit => edit.baseRevision)).toEqual([1, 2]);
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]).toMatchObject({
      kind: 'clock',
      clockFormat: '12h',
      name: 'Renamed clock',
      future: 'keep',
      frame: {future: 1},
      box: {future: 'box'},
    });
    const readOnly = setup('readOnly');
    expect(
      await readOnly.editor.patch(LAYOUT_ID, 'element', {clockFormat: '12h'}),
    ).toBe(false);
    expect(readOnly.edits).toEqual([]);
  });
  it('queues independent box patches and removes only the background field', async () => {
    const {editor, edits} = setup();
    await Promise.all([
      editor.patch(LAYOUT_ID, 'element', {box: {background: '#00AA11'}}),
      editor.patch(LAYOUT_ID, 'element', {box: {opacity: 0.5}}),
    ]);
    expect(edits.map(edit => edit.baseRevision)).toEqual([1, 2]);
    expect(edits.at(-1)?.value.layouts[0]?.elements[0]).toMatchObject({
      frame: {future: 1},
      box: {background: '#00AA11', opacity: 0.5, future: 'box'},
    });
    await editor.patch(LAYOUT_ID, 'element', {box: {background: null}});
    const box = edits.at(-1)?.value.layouts[0]?.elements[0]?.box;
    expect(box).toEqual({opacity: 0.5, future: 'box'});
    const readOnly = setup('readOnly');
    expect(
      await readOnly.editor.patch(LAYOUT_ID, 'element', {box: {opacity: 0.5}}),
    ).toBe(false);
    expect(readOnly.edits).toEqual([]);
  });
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
