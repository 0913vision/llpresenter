import {parsePayload} from '@core/schema/payload';
import type {LlpApi} from '@contracts/ipc/api';
import {stageElementIdSchema, stageLayoutIdSchema} from '@core/schema/ids';
import type {
  StageElement,
  StageLayout,
  StageLayoutsFile,
} from '@core/schema/stageLayouts';
import {REFERENCE_SCREEN} from '@renderer/render/lyricStyle';
import {STAGE_TEXT_FALLBACK} from '@renderer/render/stageLayout';
import {SettingsDocumentEditor} from '../settingsDocumentEditor';
import {nameProblem} from '@core/screens/screenEdits';
import type {NamedDocument} from '../useSettingsDocument';
import {
  editFrame,
  editFrameValue,
  type ElementFrame,
  type FrameFieldChange,
} from '@core/looks/frameEdit';

export const STAGE_LAYOUT_LIMIT = 1000;
export const STAGE_ELEMENT_LIMIT = 128;
const DEFAULT_FRAME = {x: 45, y: 100, w: 1194, h: 260};
export const STAGE_DEFAULT_TEXT: NonNullable<StageElement['text']> = {
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

export interface StageElementPatch {
  readonly name?: string;
  readonly kind?: StageElement['kind'];
  readonly clockFormat?: NonNullable<StageElement['clockFormat']>;
  readonly text?: Partial<NonNullable<StageElement['text']>>;
  readonly box?: StageBoxPatch;
}

export interface StageBoxPatch {
  readonly background?: string | null;
  readonly opacity?: number;
}

/** Serializes stage edits through the same document queue as the screen editor. */
export class StageEditor {
  private readonly documents: SettingsDocumentEditor<
    NamedDocument<'stage-layouts'>
  >;
  constructor(
    api: LlpApi,
    private readonly report: (reason: string) => void,
  ) {
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
    const id = createLayoutId();
    const saved = await this.documents.change(value => {
      if (value.layouts.length >= STAGE_LAYOUT_LIMIT) return undefined;
      const name = availableName('새 배치', value.layouts);
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
  async duplicate(layoutId: string) {
    const id = createLayoutId();
    const saved = await this.documents.change(value => {
      const source = value.layouts.find(layout => layout.id === layoutId);
      if (source === undefined || value.layouts.length >= STAGE_LAYOUT_LIMIT) {
        return undefined;
      }
      return {
        ...value,
        layouts: [
          ...value.layouts,
          {
            ...source,
            id,
            name: availableName(`${source.name.trim()} 복사본`, value.layouts),
          },
        ],
      };
    });
    return saved ? id : null;
  }
  renameLayout(layoutId: string, name: string): Promise<boolean> {
    return this.documents.change(value => {
      const current = value.layouts.find(layout => layout.id === layoutId);
      if (current === undefined) return undefined;
      if (nameProblem(name, value.layouts, layoutId) !== undefined) {
        this.report('invalid stage layout name');
        return undefined;
      }
      const trimmed = name.trim();
      if (current.name === trimmed) return undefined;
      return {
        ...value,
        layouts: value.layouts.map(layout =>
          layout.id === layoutId ? {...layout, name: trimmed} : layout,
        ),
      };
    });
  }
  async removeLayout(layoutId: string): Promise<{next: string | null} | null> {
    let next: string | null = null;
    const saved = await this.documents.change(value => {
      const index = value.layouts.findIndex(layout => layout.id === layoutId);
      if (index < 0) return undefined;
      const layouts = value.layouts.filter(layout => layout.id !== layoutId);
      next = layouts[Math.min(index, layouts.length - 1)]?.id ?? null;
      return {...value, layouts};
    });
    return saved ? {next} : null;
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
        text: {...STAGE_DEFAULT_TEXT},
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
  async frameValue(
    layoutId: string,
    elementId: string,
    change: FrameFieldChange,
  ): Promise<ElementFrame | null> {
    if (!Number.isFinite(change.value)) return null;
    const result: {frame: ElementFrame | null; changed: boolean} = {
      frame: null,
      changed: false,
    };
    const saved = await this.change(layoutId, layout => {
      const current = layout.elements.find(element => element.id === elementId);
      if (current === undefined) return undefined;
      const frame = editFrameValue(current.frame, change, layout);
      result.frame = frame;
      if (frame === current.frame) return undefined;
      result.changed = true;
      return {
        ...layout,
        elements: layout.elements.map(element =>
          element.id === elementId ? {...element, frame} : element,
        ),
      };
    });
    return result.changed && !saved ? null : result.frame;
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
          ? {
              ...element,
              frame: editFrame(element.frame, delta, {handle: 'move'}),
            }
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
  patch(
    layoutId: string,
    elementId: string,
    patch: StageElementPatch,
  ): Promise<boolean> {
    return this.change(layoutId, layout => ({
      ...layout,
      elements: layout.elements.map(element =>
        element.id === elementId
          ? {
              ...element,
              ...(patch.name === undefined ? {} : {name: patch.name}),
              ...(patch.kind === undefined ? {} : {kind: patch.kind}),
              ...(patch.clockFormat === undefined
                ? {}
                : {clockFormat: patch.clockFormat}),
              ...(patch.box === undefined
                ? {}
                : {box: patchBox(element.box, patch.box)}),
              ...(patch.text === undefined
                ? {}
                : {
                    text: {
                      ...STAGE_TEXT_FALLBACK,
                      ...element.text,
                      ...patch.text,
                    },
                  }),
            }
          : element,
      ),
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

function createLayoutId() {
  const parsed = parsePayload(stageLayoutIdSchema, crypto.randomUUID());
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

function availableName(base: string, layouts: readonly StageLayout[]): string {
  let name = base,
    suffix = 2;
  while (layouts.some(layout => layout.name.trim() === name)) {
    name = `${base} ${suffix++}`;
  }
  return name;
}

function patchBox(
  current: StageElement['box'],
  patch: StageBoxPatch,
): NonNullable<StageElement['box']> {
  const next = {...current};
  if (patch.opacity !== undefined) next.opacity = patch.opacity;
  if (patch.background === null) delete next.background;
  else if (patch.background !== undefined) next.background = patch.background;
  return next;
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
