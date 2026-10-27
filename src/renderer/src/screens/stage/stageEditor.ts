import {parsePayload} from '@shared/schema/payload';
import type {LlpApi} from '@shared/ipc';
import {stageElementIdSchema, stageLayoutIdSchema} from '@shared/schema/ids';
import type {
  StageElement,
  StageLayout,
  StageLayoutsFile,
} from '@shared/schema/stageLayouts';
import {REFERENCE_SCREEN} from '@renderer/render/lyricStyle';
import {SettingsDocumentEditor} from '../settingsDocumentEditor';
import type {NamedDocument} from '../useSettingsDocument';
import {editFrame, type ElementFrame} from './frameEdit';

export const STAGE_LAYOUT_LIMIT = 1000;
export const STAGE_ELEMENT_LIMIT = 128;
const DEFAULT_FRAME = {x: 45, y: 100, w: 1194, h: 260};
const DEFAULT_TEXT: NonNullable<StageElement['text']> = {
  font: 'Pretendard',
  weight: 700,
  size: 72,
  color: '#FFFFFF',
  align: 'left',
  vAlign: 'top',
  lineHeight: 1.3,
  autoFit: true,
};
export const elementNames: Readonly<Record<StageElement['kind'], string>> = {
  currentSlide: '현재 가사',
  nextSlide: '다음 가사',
  currentLabel: '현재 이름표',
  nextLabel: '다음 이름표',
  clock: '시계',
  timer: '타이머',
  stageMessage: '무대 메시지',
};

/** Serializes stage edits through the same document queue as the screen editor. */
export class StageEditor {
  private readonly documents: SettingsDocumentEditor<
    NamedDocument<'stage-layouts'>
  >;
  constructor(api: LlpApi, report: (reason: string) => void) {
    this.documents = new SettingsDocumentEditor(api, {
      update: (base, value) => ({
        type: 'settings.update',
        name: 'stage-layouts',
        baseRevision: base.revision,
        value,
      }),
      report,
      failureTitle: '무대 배치 저장 실패',
      logMessage: 'Could not save stage layouts',
    });
  }
  adopt(document: NamedDocument<'stage-layouts'> | null): void {
    this.documents.adopt(document);
  }
  async create() {
    const parsed = parsePayload(stageLayoutIdSchema, crypto.randomUUID());
    if (!parsed.ok) throw new Error(parsed.error.message);
    const id = parsed.value;
    const saved = await this.documents.change(value => {
      if (value.layouts.length >= STAGE_LAYOUT_LIMIT) return undefined;
      let name = '새 배치',
        suffix = 2;
      while (value.layouts.some(layout => layout.name === name)) {
        name = `새 배치 ${suffix++}`;
      }
      return {
        ...value,
        layouts: [
          ...value.layouts,
          {id, name, width: 1920, height: 1080, elements: []},
        ],
      };
    });
    return saved ? id : null;
  }
  async add(layoutId: string, kind: StageElement['kind']) {
    const parsed = parsePayload(stageElementIdSchema, crypto.randomUUID());
    if (!parsed.ok) throw new Error(parsed.error.message);
    const id = parsed.value;
    const saved = await this.change(layoutId, layout => {
      if (layout.elements.length >= STAGE_ELEMENT_LIMIT) return undefined;
      const sx = layout.width / REFERENCE_SCREEN.width;
      const sy = layout.height / REFERENCE_SCREEN.height;
      const element: StageElement = {
        id,
        kind,
        name: elementNames[kind],
        frame: {
          x: Math.round(DEFAULT_FRAME.x * sx),
          y: Math.round(DEFAULT_FRAME.y * sy),
          w: Math.max(1, Math.round(DEFAULT_FRAME.w * sx)),
          h: Math.max(1, Math.round(DEFAULT_FRAME.h * sy)),
        },
        text: {...DEFAULT_TEXT},
      };
      return {...layout, elements: [...layout.elements, element]};
    });
    return saved ? id : null;
  }
  frame(
    layoutId: string,
    elementId: string,
    frame: ElementFrame,
  ): Promise<boolean> {
    return this.change(layoutId, layout => ({
      ...layout,
      elements: layout.elements.map(element =>
        element.id === elementId
          ? {...element, frame: {...element.frame, ...frame}}
          : element,
      ),
    }));
  }
  nudge(
    layoutId: string,
    elementId: string,
    delta: {x: number; y: number},
  ): Promise<boolean> {
    return this.change(layoutId, layout => ({
      ...layout,
      elements: layout.elements.map(element =>
        element.id === elementId
          ? {...element, frame: editFrame(element.frame, delta, 'move')}
          : element,
      ),
    }));
  }
  remove(layoutId: string, elementId: string): Promise<boolean> {
    return this.change(layoutId, layout => ({
      ...layout,
      elements: layout.elements.filter(element => element.id !== elementId),
    }));
  }
  private change(
    layoutId: string,
    transform: (layout: StageLayout) => StageLayout | undefined,
  ): Promise<boolean> {
    return this.documents.change(value =>
      updateLayout(value, layoutId, transform),
    );
  }
}

function updateLayout(
  value: StageLayoutsFile,
  id: string,
  change: (layout: StageLayout) => StageLayout | undefined,
): StageLayoutsFile | undefined {
  const layout = value.layouts.find(layout => layout.id === id);
  if (layout === undefined) return undefined;
  const next = change(layout);
  if (next === undefined) return undefined;
  return {
    ...value,
    layouts: value.layouts.map(layout => (layout.id === id ? next : layout)),
  };
}
