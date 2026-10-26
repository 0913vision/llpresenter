import type {LlpApi} from '@shared/ipc';
import type {
  BibleLookupReply,
  BibleLookupRequest,
} from '@shared/schema/bibleLookup';

/** Keeps one read in flight and replaces waiting input with the newest request. */
export class LatestLookup {
  private pending: BibleLookupRequest | null = null;
  private version = 0;
  private reading = false;
  private closed = false;

  constructor(
    private readonly api: LlpApi['bible'],
    private readonly accept: (reply: BibleLookupReply) => void,
    private readonly fail: (
      request: BibleLookupRequest,
      error: unknown,
    ) => void,
  ) {}

  request(request: BibleLookupRequest | null): void {
    if (this.closed) return;
    this.version++;
    this.pending = request?.input.trim() ? request : null;
    if (!this.reading) {
      this.read().catch((error: unknown) => {
        this.reading = false;
        console.error('Bible lookup callback failed', error);
      });
    }
  }

  dispose(): void {
    this.closed = true;
    this.pending = null;
    this.version++;
  }

  private isCurrent(version: number): boolean {
    return !this.closed && version === this.version;
  }

  private async read(): Promise<void> {
    this.reading = true;
    while (!this.closed && this.pending !== null) {
      const request = this.pending;
      const version = this.version;
      this.pending = null;
      try {
        const reply = await this.api.lookup(request);
        if (this.isCurrent(version)) this.accept(reply);
      } catch (error: unknown) {
        if (this.isCurrent(version)) this.fail(request, error);
      }
    }
    this.reading = false;
  }
}
