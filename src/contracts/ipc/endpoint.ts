import type {Result} from '@core/common/result';
import type {PayloadError} from '@core/schema/payload';

/** Checks a value that crossed the process boundary. */
export type Parse<T> = (value: unknown) => Result<T, PayloadError>;

/** Removes a listener. Always call it. */
export type Unsubscribe = () => void;

/** A call without an argument that main answers. */
export interface QueryEndpoint<TReply> {
  readonly channel: string;
  readonly reply: Parse<TReply>;
}

/** A call with one argument that main answers. */
export interface RequestEndpoint<TRequest, TReply> {
  readonly channel: string;
  readonly request: Parse<TRequest>;
  /** Checks main's answer, against the request where the answer echoes it. */
  readonly reply: (
    value: unknown,
    request: TRequest,
  ) => Result<TReply, PayloadError>;
  /**
   * The answer to a request that fails its check, the same one main gives.
   * Without it, such a request rejects.
   */
  readonly refuse?: (error: PayloadError) => TReply;
}

/** A message to main without an argument or an answer. */
export interface SignalEndpoint {
  readonly channel: string;
}

/** A message to main without an answer. */
export interface MessageEndpoint<TMessage> {
  readonly channel: string;
  readonly message: Parse<TMessage>;
}

/** The parts of a message that passed their checks, and those that failed. */
export interface PartialMessage<TMessage> {
  readonly accepted: TMessage;
  readonly rejected: readonly PayloadError[];
}

/**
 * A message to main whose parts are checked one by one: the parts that fail
 * are dropped and logged, and the rest is sent.
 */
export interface PartialMessageEndpoint<TMessage> {
  readonly channel: string;
  readonly message: Parse<PartialMessage<TMessage>>;
}

/** A value main pushes to every window. */
export interface PushEndpoint<TValue> {
  readonly channel: string;
  readonly value: Parse<TValue>;
}

/**
 * How a window reaches main. The preload script implements it once: it checks
 * every request and reply with the endpoint's parsers, logs what fails, and
 * rejects a call whose reply fails.
 */
export interface IpcPort {
  query<TReply>(endpoint: QueryEndpoint<TReply>): () => Promise<TReply>;
  request<TRequest, TReply>(
    endpoint: RequestEndpoint<TRequest, TReply>,
  ): (request: TRequest) => Promise<TReply>;
  signal(endpoint: SignalEndpoint): () => void;
  message<TMessage>(
    endpoint: MessageEndpoint<TMessage>,
  ): (message: TMessage) => void;
  partialMessage<TMessage>(
    endpoint: PartialMessageEndpoint<TMessage>,
  ): (message: TMessage) => void;
  subscribe<TValue>(
    endpoint: PushEndpoint<TValue>,
  ): (listener: (value: TValue) => void) => Unsubscribe;
}

/** What only the preload script can read, outside IPC. */
export interface WindowPlatform {
  /** A native dropped File's path, or an empty string when unavailable. */
  pathForFile(file: File): string;
  /** This window's actual zoom factor, bounded to 1 to 2. */
  zoomFactor(): number;
}

/** Declares a call without an argument that main answers. */
export function query<TReply>(
  channel: string,
  reply: Parse<TReply>,
): QueryEndpoint<TReply> {
  return {channel, reply};
}

/** Declares a call with one argument that main answers. */
export function request<TRequest, TReply>(
  channel: string,
  checks: Omit<RequestEndpoint<TRequest, TReply>, 'channel'>,
): RequestEndpoint<TRequest, TReply> {
  return {channel, ...checks};
}

/** Declares a message to main without an argument or an answer. */
export function signal(channel: string): SignalEndpoint {
  return {channel};
}

/** Declares a message to main without an answer. */
export function message<TMessage>(
  channel: string,
  parse: Parse<TMessage>,
): MessageEndpoint<TMessage> {
  return {channel, message: parse};
}

/** Declares a message whose parts are checked one by one. */
export function partialMessage<TMessage>(
  channel: string,
  parse: Parse<PartialMessage<TMessage>>,
): PartialMessageEndpoint<TMessage> {
  return {channel, message: parse};
}

/** Declares a value main pushes to every window. */
export function push<TValue>(
  channel: string,
  parse: Parse<TValue>,
): PushEndpoint<TValue> {
  return {channel, value: parse};
}
