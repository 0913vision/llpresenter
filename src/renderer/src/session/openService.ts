import {create} from 'zustand';
import type {LlpApi} from '@contracts/ipc/api';
import type {Result} from '@core/common/result';
import {sameJson} from '@core/common/sameJson';
import type {ServiceDocument} from '@core/schema/services/contentDocuments';
import type {EditFailure} from '@core/schema/services/contentEdit';
import type {ServiceItemId} from '@core/schema/common/ids';
import {
  hasSlides,
  type Service,
  type ServiceItem,
  type SlidesItem,
} from '@core/schema/services/service';
import type {Slide} from '@core/schema/slides/slide';
import {withOneSermonTitle} from '@core/slides';
import {pendingWritesOf} from '../platform/pendingWrites';
import {useShow} from './showStore';
import {serviceEditNotice} from './serviceProblem';
import {
  undoTimeline,
  type UndoOwner,
  type UndoPlace,
} from '../platform/undoTimeline';
import {changedPlace} from '@core/services';

type Order = Service['order'];
type EditApi = Pick<LlpApi, 'services' | 'content' | 'log'>;

const HISTORY_LIMIT = 100;
/** Typing that goes on within this time is undone as one step. */
const TYPING_PAUSE_MS = 1500;

interface Step {
  readonly serviceId: Service['id'];
  readonly before: Order;
  readonly after: Order;
  readonly key?: string | undefined;
  readonly time: number;
}

/** The open 예배 순서 as this window edits it, with what it has not sent yet. */
export interface OpenServiceView {
  readonly service: Service | null;
  readonly readOnly: boolean;
  readonly past: readonly Step[];
  readonly future: readonly Step[];
}

export const useOpenService = create<OpenServiceView>(() => ({
  service: null,
  readOnly: false,
  past: [],
  future: [],
}));

interface LocalFailure {
  readonly reason: 'busy' | 'request-failed' | 'full';
  readonly message: string;
}
export type OpenServiceResult = Result<boolean, EditFailure | LocalFailure>;

/** Changes the order, or says why it can't. */
export type OrderChange = (
  service: Service,
) => Result<Order, EditFailure | LocalFailure>;

interface Waiting {
  change: OrderChange;
  readonly key: string | undefined;
  readonly done: Array<(result: OpenServiceResult) => void>;
}

export interface EditOptions {
  /** Edits with the same key right after another count as one. */
  readonly key?: string | undefined;
  /** An undo or a redo makes no step of its own. */
  readonly replay?: boolean;
}

function refuse(
  reason: 'invalid' | 'not-found' | 'read-only' | 'stale',
  message: string,
): {readonly ok: false; readonly error: EditFailure} {
  return {ok: false, error: {reason, message}};
}

/** The one editor of the open 예배 순서: every change goes through it, in order. */
class OpenServiceEditor {
  private base: ServiceDocument | null = null;
  private readonly waiting: Waiting[] = [];
  private sending = false;

  constructor(private readonly api: EditApi) {}

  /** Follows a document the main process has, unless it is older. */
  accept(document: ServiceDocument | null): void {
    if (
      document !== null &&
      this.base?.service.id === document.service.id &&
      document.revision < this.base.revision
    ) {
      return;
    }
    if (document?.service.id !== this.base?.service.id) {
      for (const {done} of this.waiting.splice(0)) {
        for (const answer of done) {
          answer(refuse('not-found', 'Another service opened'));
        }
      }
      useOpenService.setState({past: [], future: []});
      undoTimeline.forget(serviceHistory);
    }
    this.base = document;
    this.show();
  }

  edit(change: OrderChange, options: EditOptions): Promise<OpenServiceResult> {
    const {service, readOnly} = useOpenService.getState();
    if (service === null) {
      return Promise.resolve(refuse('not-found', 'No service is open'));
    }
    if (readOnly) {
      return Promise.resolve(refuse('read-only', 'The service is read-only'));
    }
    const result = change(service);
    if (!result.ok) return Promise.resolve(result);
    if (sameJson(service.order, result.value)) {
      return Promise.resolve({ok: true, value: false});
    }
    if (options.replay !== true) {
      this.record(service, result.value, options.key);
    }
    const last = this.waiting.at(-1);
    const joins =
      options.key !== undefined &&
      last?.key === options.key &&
      !(this.sending && this.waiting.length === 1);
    return new Promise(resolve => {
      if (joins) {
        last.change = change;
        last.done.push(resolve);
      } else {
        this.waiting.push({change, key: options.key, done: [resolve]});
      }
      this.show();
      this.send().catch((error: unknown) => this.fail(error));
    });
  }

  private record(service: Service, after: Order, key: string | undefined) {
    const {past} = useOpenService.getState();
    const last = past.at(-1);
    const time = Date.now();
    const step: Step = {
      serviceId: service.id,
      before: service.order,
      after,
      key,
      time,
    };
    const goesOn =
      key !== undefined &&
      last?.key === key &&
      time - last.time < TYPING_PAUSE_MS;
    useOpenService.setState({
      past: goesOn
        ? [...past.slice(0, -1), {...step, before: last.before}]
        : [...past, step].slice(-HISTORY_LIMIT),
      future: [],
    });
    if (!goesOn) undoTimeline.record(serviceHistory);
  }

  /** What is shown: the document with every change that waits. */
  private show(): void {
    const {base} = this;
    let service = base?.service ?? null;
    if (service !== null) {
      for (const {change} of this.waiting) {
        const result = change(service);
        if (result.ok) service = {...service, order: result.value};
      }
    }
    useOpenService.setState({service, readOnly: base?.access === 'readOnly'});
  }

  private async send(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      for (
        let next = this.waiting[0];
        next !== undefined;
        next = this.waiting[0]
      ) {
        const result = await this.sendOne(next.change);
        this.waiting.shift();
        this.show();
        for (const answer of next.done) answer(result);
      }
    } finally {
      this.sending = false;
    }
  }

  private async sendOne(change: OrderChange): Promise<OpenServiceResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const {base} = this;
      if (base === null) return refuse('not-found', 'No service is open');
      const result = change(base.service);
      if (!result.ok) return result;
      const service = {...base.service, order: result.value};
      const saved = await this.api.content.edit({
        type: 'service.update',
        baseRevision: base.revision,
        service,
      });
      const applied = saved.ok
        ? saved.value
        : saved.error.reason === 'write-failed'
          ? saved.error.applied
          : undefined;
      if (applied?.revision != null) {
        if ((this.base?.revision ?? 0) <= applied.revision) {
          this.base = {...base, service, revision: applied.revision};
        }
        return saved.ok ? {ok: true, value: true} : saved;
      }
      if (saved.ok) return {ok: true, value: true};
      if (saved.error.reason !== 'stale') return saved;
      const fresh = await this.api.services.get(base.service.id);
      if (fresh === null) return refuse('not-found', 'The service is gone');
      this.base = fresh;
    }
    return refuse('stale', 'The service keeps changing');
  }

  private fail(error: unknown): void {
    this.api.log.write({
      level: 'error',
      message: 'Could not save an edit of the open service',
      detail: error instanceof Error ? error.message : String(error),
    });
    const failed: OpenServiceResult = {
      ok: false,
      error: {
        reason: 'request-failed',
        message: error instanceof Error ? error.message : String(error),
      },
    };
    for (const {done} of this.waiting.splice(0)) {
      for (const answer of done) answer(failed);
    }
    this.show();
  }
}

const editors = new WeakMap<EditApi, OpenServiceEditor>();

function editorOf(api: EditApi): OpenServiceEditor {
  let editor = editors.get(api);
  if (editor === undefined) {
    editor = new OpenServiceEditor(api);
    editors.set(api, editor);
  }
  return editor;
}

/**
 * Changes the open 예배 순서. It shows at once, and the promise answers when
 * the main process has it.
 */
export function editOpenService(
  change: OrderChange,
  options: EditOptions = {},
): Promise<OpenServiceResult> {
  const api = window.llp;
  if (api === undefined) {
    return Promise.resolve(refuse('not-found', 'No service is open'));
  }
  return pendingWritesOf(api).run({
    write: () => editorOf(api).edit(change, options),
    refused: {
      ok: false,
      error: {reason: 'busy', message: 'Edits stopped for closing'},
    },
    sent: result => result.ok || result.error.reason === 'write-failed',
  });
}

/** Changes one item of the open 예배 순서; null refuses. */
export function editItem(
  itemId: string,
  change: (item: ServiceItem) => ServiceItem | null,
  options: EditOptions = {},
): Promise<OpenServiceResult> {
  return editOpenService(service => {
    const item = service.order.find(row => row.id === itemId);
    const changed = item === undefined ? null : change(item);
    if (changed === null) {
      return refuse('not-found', 'The item no longer takes this change');
    }
    return {
      ok: true,
      value: service.order.map(row => (row.id === itemId ? changed : row)),
    };
  }, options);
}

/** Changes the slides of an item of the open 예배 순서. */
export function editItemSlides(
  itemId: string,
  change: (slides: readonly Slide[], item: SlidesItem) => readonly Slide[],
  options: EditOptions = {},
): Promise<OpenServiceResult> {
  return editItem(
    itemId,
    item => {
      if (!hasSlides(item)) return null;
      const changed = change(item.slides, item);
      const slides =
        item.kind === 'sermon'
          ? withOneSermonTitle(item.slides, changed)
          : changed;
      return slides === item.slides ? item : {...item, slides};
    },
    options,
  );
}

function replay(direction: 'undo' | 'redo'): Promise<OpenServiceResult> {
  const {past, future} = useOpenService.getState();
  const step = (direction === 'undo' ? past : future).at(-1);
  if (step === undefined) return Promise.resolve({ok: true, value: false});
  const [expected, wanted] =
    direction === 'undo'
      ? [step.after, step.before]
      : [step.before, step.after];
  return editOpenService(
    service => {
      if (!sameJson(service.order, expected)) {
        return refuse('stale', 'The service order changed after this edit');
      }
      return {ok: true, value: wanted};
    },
    {replay: true},
  ).then(result => {
    if (!result.ok) return result;
    const now = useOpenService.getState();
    useOpenService.setState(
      direction === 'undo'
        ? {
            past: now.past.filter(entry => entry !== step),
            future: [...now.future, step],
          }
        : {
            past: [...now.past, step],
            future: now.future.filter(entry => entry !== step),
          },
    );
    return result;
  });
}

export function undoService(): Promise<OpenServiceResult> {
  return replay('undo');
}

export function redoService(): Promise<OpenServiceResult> {
  return replay('redo');
}

let lastPlace: UndoPlace | undefined;

/** The service edits, as one history of the window's 실행 취소. */
const serviceHistory: UndoOwner = {
  replay: (kind, report) => {
    const {past, future} = useOpenService.getState();
    const step = (kind === 'undo' ? past : future).at(-1);
    return replay(kind).then(result => {
      const notice = serviceEditNotice(result);
      if (notice !== null) report(notice);
      const changed =
        step === undefined
          ? undefined
          : kind === 'undo'
            ? changedPlace(step.after, step.before)
            : changedPlace(step.before, step.after);
      lastPlace =
        changed === undefined ? undefined : {kind: 'service', ...changed};
      return result.ok;
    });
  },
  place: () => lastPlace,
};

/** The item of the open 예배 순서 with this id, as this window edits it. */
export function useServiceItem(itemId: string | null): ServiceItem | undefined {
  return useOpenService(view =>
    view.service?.order.find(item => item.id === itemId),
  );
}

export function serviceItem(itemId: string): ServiceItem | undefined {
  return useOpenService
    .getState()
    .service?.order.find(item => item.id === itemId);
}

/**
 * Follows the document of the open 예배 순서.
 *
 * @returns A function that stops following. Always call it.
 */
export function startOpenServiceSync(): () => void {
  const api = window.llp;
  if (api === undefined) return () => undefined;
  const editor = editorOf(api);
  let stopped = false;
  let open: string | null = null;
  const read = (id: string | null): void => {
    if (open === id) return;
    open = id;
    if (id === null) {
      editor.accept(null);
      return;
    }
    api.services.get(id).then(
      document => {
        if (!stopped && open === id) editor.accept(document);
      },
      () => undefined,
    );
  };
  const stops = [
    useShow.subscribe(view => read(view.serviceId)),
    api.services.subscribe(change => {
      if (change.serviceId === open) editor.accept(change.document);
    }),
  ];
  read(useShow.getState().serviceId);
  return () => {
    stopped = true;
    for (const stop of stops) stop();
  };
}

export type {ServiceItemId};
