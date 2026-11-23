type Handler = (event: unknown, value?: unknown) => unknown;

/** A window that calls main, from its main frame. */
export interface MockCaller {
  readonly id: number;
  readonly mainFrame?: unknown;
}

const WINDOW: MockCaller = {id: 1};

function eventOf(sender: MockCaller = WINDOW) {
  return {sender, senderFrame: sender.mainFrame};
}

/** An `ipcMain` whose channels a test calls as a window would. */
export function mockIpcMain() {
  const handlers = new Map<string, Handler>();
  const listeners = new Map<string, Set<Handler>>();
  const answer = (
    {channel}: {readonly channel: string},
    value?: unknown,
    sender?: MockCaller,
  ): unknown => {
    const handler = handlers.get(channel);
    if (handler === undefined) throw new Error(`No handler of ${channel}`);
    return handler(eventOf(sender), value);
  };
  return {
    handlers,
    /** Whether main still answers or hears a channel. */
    has: (channel: string): boolean =>
      handlers.has(channel) || (listeners.get(channel)?.size ?? 0) > 0,
    ipcMain: {
      handle: (channel: string, handler: Handler) => {
        handlers.set(channel, handler);
      },
      removeHandler: (channel: string) => {
        handlers.delete(channel);
      },
      on: (channel: string, listener: Handler) => {
        const known = listeners.get(channel) ?? new Set();
        listeners.set(channel, known.add(listener));
      },
      removeListener: (channel: string, listener: Handler) => {
        listeners.get(channel)?.delete(listener);
      },
    },
    /** Forgets every channel. */
    reset: () => {
      handlers.clear();
      listeners.clear();
    },
    /** How many channels main answers or hears. */
    open: (): number =>
      [...listeners.values()].reduce(
        (sum, {size}) => sum + size,
        handlers.size,
      ),
    /** Calls a channel and gives what its handler returns. */
    answer,
    /** Calls a channel and gives main's answer, as a window gets it. */
    invoke: async (...call: Parameters<typeof answer>): Promise<unknown> =>
      answer(...call),
    /** Sends a message to a channel. */
    send: (
      {channel}: {readonly channel: string},
      value?: unknown,
      sender?: MockCaller,
    ): void => {
      for (const listener of listeners.get(channel) ?? []) {
        listener(eventOf(sender), value);
      }
    },
  };
}

export type MockIpcMain = ReturnType<typeof mockIpcMain>;
