/** Delivers at most one outstanding native frame to each window. */
export class PreviewFrameFanout {
  private readonly clients = new Map<
    number,
    {
      pending: boolean;
      revision: number;
      send: (frame: Uint8Array | null) => void;
    }
  >();
  private latest: Uint8Array | null = null;
  private revision = 0;
  private except: number | undefined;

  get empty(): boolean {
    return this.clients.size === 0;
  }

  get size(): number {
    return this.clients.size;
  }

  get hasCapacity(): boolean {
    return [...this.clients.values()].some(client => !client.pending);
  }

  add(id: number, send: (frame: Uint8Array | null) => void): void {
    const client = {pending: false, revision: 0, send};
    this.clients.set(id, client);
    if (this.latest !== null && id !== this.except) {
      this.deliver(client, this.latest);
    }
  }

  remove(id: number): void {
    this.clients.delete(id);
  }

  ack(id: number): void {
    const client = this.clients.get(id);
    if (client !== undefined) {
      client.pending = false;
      if (
        id !== this.except &&
        this.latest !== null &&
        client.revision < this.revision
      ) {
        this.deliver(client, this.latest);
      }
    }
  }

  publish(frame: Uint8Array | null, except?: number): void {
    this.latest = frame;
    this.except = except;
    this.revision++;
    for (const [id, client] of this.clients) {
      if (id !== except) this.deliver(client, frame);
    }
  }

  private deliver(
    client: {
      pending: boolean;
      revision: number;
      send: (frame: Uint8Array | null) => void;
    },
    frame: Uint8Array | null,
  ): void {
    if (frame !== null && client.pending) return;
    if (frame !== null) client.pending = true;
    client.revision = this.revision;
    client.send(frame);
  }
}
