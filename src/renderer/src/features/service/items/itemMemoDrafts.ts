import type {ServiceDocument} from '@core/schema/contentDocuments';
import {withStartField} from '@core/services/itemFieldChanges';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {ItemEditQueue, ItemProblem, ItemTarget} from './itemEditQueue';
// NOTE(0913vision): No text may vanish, so a draft is never dropped by age.
// Drafts are bounded by the items they were typed for; this limit only
// refuses a new draft when that many are still unsaved.
const MAX_MEMO_DRAFTS = 100;
/** The refusal shown when all unsaved-item draft slots are occupied. */
export const TOO_MANY_DRAFTS = '저장하지 못한 메모가 너무 많음';
function draftKey({serviceId, itemId}: ItemTarget): string {
  return `${serviceId}:${itemId}`;
}
/** Keeps at most 100 unsaved item memos without age eviction or overwriting newer text. */
export class ItemMemoDrafts {
  private readonly memoDrafts = new Map<
    string,
    {readonly target: ItemTarget; readonly memo: string}
  >();
  /** Shares one queue and reports draft changes through the facade's publication. */
  constructor(
    private readonly edits: ItemEditQueue,
    private readonly changed: () => void,
    private readonly problem: ItemProblem,
  ) {}
  /** Retains a captured draft and admits its whole save through the item queue. */
  async save(target: ItemTarget, memo: string): Promise<boolean> {
    if (!this.type(target, memo)) return false;
    return this.edits.run(() => this.saveMemo(target, memo));
  }
  /** Keeps typed text without sending it so close preflight can still see it. */
  type(target: ItemTarget, memo: string): boolean {
    return this.keepMemoDraft(draftKey(target), target, memo);
  }
  /** Reads the unsaved draft for one captured item. */
  get(target: ItemTarget): string | undefined {
    return this.memoDrafts.get(draftKey(target))?.memo;
  }
  /** Whether an existing draft can change or one new draft can be retained. */
  hasRoom(target: ItemTarget): boolean {
    return (
      this.memoDrafts.has(draftKey(target)) ||
      this.memoDrafts.size < MAX_MEMO_DRAFTS
    );
  }
  private keepMemoDraft(
    key: string,
    target: ItemTarget,
    memo: string,
  ): boolean {
    if (!this.memoDrafts.has(key) && this.memoDrafts.size >= MAX_MEMO_DRAFTS) {
      this.problem(TOO_MANY_DRAFTS);
      return false;
    }
    this.memoDrafts.set(key, {target, memo});
    this.changed();
    return true;
  }
  /** Forgets drafts only for items removed from this service. */
  forgetDeleted(serviceId: string, document: ServiceDocument | null): void {
    const kept = new Set<string>(document?.service.order.map(item => item.id));
    for (const [key, {target}] of this.memoDrafts) {
      if (target.serviceId === serviceId && !kept.has(target.itemId)) {
        this.memoDrafts.delete(key);
      }
    }
  }
  private async saveMemo(target: ItemTarget, memo: string): Promise<boolean> {
    const key = draftKey(target);
    const saved = await this.edits.apply({
      change: withStartField('memo', memo === '' ? undefined : memo),
      failure: '메모 저장 실패',
      target,
      retry: () => this.retryMemo(target),
    });
    if (saved && this.memoDrafts.get(key)?.memo === memo) {
      this.memoDrafts.delete(key);
      this.changed();
    }
    return saved;
  }
  private retryMemo(target: ItemTarget): void {
    const memo = this.get(target);
    if (memo !== undefined) editorTask(this.save(target, memo));
  }
  /** After current edits, queues remaining drafts even while new writes are stopped. */
  async flush(): Promise<boolean> {
    await this.edits.waitIdle();
    const saved = await Promise.all(
      [...this.memoDrafts.values()].map(({target, memo}) =>
        this.edits.enqueue(() => this.saveMemo(target, memo)),
      ),
    );
    return saved.every(Boolean) && this.memoDrafts.size === 0;
  }
}
