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

  get empty(): boolean {
    return this.clients.size === 0;
  }

  get hasCapacity(): boolean {
    return [...this.clients.values()].some(client => !client.pending);
  }

  add(id: number, send: (frame: Uint8Array | null) => void): void {
    const client = {pending: false, revision: 0, send};
    this.clients.set(id, client);
    if (this.latest !== null) this.deliver(client, this.latest);
  }

  remove(id: number): void {
    this.clients.delete(id);
  }

  ack(id: number): void {
    const client = this.clients.get(id);
    if (client !== undefined) {
      client.pending = false;
      if (this.latest !== null && client.revision < this.revision) {
        this.deliver(client, this.latest);
      }
    }
  }

  publish(frame: Uint8Array | null): void {
    this.latest = frame;
    this.revision++;
    for (const client of this.clients.values()) this.deliver(client, frame);
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
