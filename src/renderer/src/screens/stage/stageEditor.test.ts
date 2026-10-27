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
