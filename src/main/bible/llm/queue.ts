import {BIBLE_AI_LIMITS, type BibleAiRequest} from '@core/schema/bibleAi';

interface Job {
  readonly owner: number;
  readonly request: BibleAiRequest;
  readonly controller: AbortController;
  readonly resolve: (index: number) => void;
  readonly reject: (error: unknown) => void;
}

/** Serializes entire comparisons, so swapped prompts cannot interleave. */
export class ChooserQueue {
  private readonly waiting: Job[] = [];
  private active: Job | null = null;
  private stopped = false;

  constructor(
    private readonly choose: (
      request: BibleAiRequest,
      signal: AbortSignal,
    ) => Promise<number>,
  ) {}

  enqueue(owner: number, request: BibleAiRequest): Promise<number> {
    if (this.stopped) return Promise.reject(new Error('LLM queue stopped'));
    if (this.waiting.length >= BIBLE_AI_LIMITS.pending) {
      return Promise.reject(new Error('LLM queue limit exceeded'));
    }
    return new Promise((resolve, reject) => {
      this.waiting.push({
        owner,
        request,
        controller: new AbortController(),
        resolve,
        reject,
      });
      this.runNext();
    });
  }

  cancel(owner: number, lookupId?: string): boolean {
    const matches = (job: Job): boolean =>
      job.owner === owner &&
      (lookupId === undefined || job.request.lookupId === lookupId);
    let cancelled = false;
    if (this.active && matches(this.active)) {
      this.active.controller.abort();
      cancelled = true;
    }
    for (let i = this.waiting.length - 1; i >= 0; i--) {
      const job = this.waiting[i];
      if (!job || !matches(job)) continue;
      this.waiting.splice(i, 1);
      job.reject(new Error('LLM lookup cancelled'));
      cancelled = true;
    }
    return cancelled;
  }

  stop(): void {
    this.stopped = true;
    this.active?.controller.abort();
    for (const job of this.waiting.splice(0)) {
      job.reject(new Error('LLM queue stopped'));
    }
  }

  private runNext(): void {
    if (this.active || this.stopped) return;
    const job = this.waiting.shift();
    if (!job) return;
    this.active = job;
    this.choose(job.request, job.controller.signal)
      .then(index => {
        job.controller.signal.throwIfAborted();
        job.resolve(index);
      })
      .catch((error: unknown) => job.reject(error))
      .finally(() => {
        this.active = null;
        this.runNext();
      });
  }
}
