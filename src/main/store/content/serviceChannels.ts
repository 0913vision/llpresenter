import {serviceEndpoints} from '@contracts/ipc/service';
import type {
  ServiceOpenRefusal,
  ServiceOpenRequest,
  ServiceOpenResult,
} from '@core/schema/serviceOpen';
import {IpcHost} from '../../base/ipcHost';
import type {Logger} from '../../base/log';
import type {AppConfigFile} from '../locations/appConfigFile';
import type {ContentStore} from './contentStore';
import type {OpenServiceFeed} from './openServiceFeed';

export interface ServiceSession {
  readonly content: Pick<ContentStore, 'openService'>;
  readonly feed: Pick<OpenServiceFeed, 'current' | 'refresh'>;
}

export const MAX_PENDING_SERVICE_SWITCHES = 16;

function refused(reason: ServiceOpenRefusal): ServiceOpenResult {
  return {ok: false, error: {reason}};
}

interface ServiceSwitchOptions {
  readonly appConfig: Pick<AppConfigFile, 'setLastServiceId' | 'flush'>;
  readonly log: Logger;
  readonly onServiceChanged: () => void;
}

/** Opens one 예배 순서 after another, in the order they were asked for. */
class ServiceSwitches {
  private last: Promise<void> = Promise.resolve();
  private pending = 0;

  constructor(private readonly options: ServiceSwitchOptions) {}

  /** Settles once every accepted switch has ended. */
  ended(): Promise<void> {
    return this.last;
  }

  async open(
    session: ServiceSession,
    request: ServiceOpenRequest,
  ): Promise<ServiceOpenResult> {
    const {log} = this.options;
    if (this.pending >= MAX_PENDING_SERVICE_SWITCHES) {
      log.warn('too many pending service switches');
      return refused('busy');
    }
    this.pending++;
    const result = this.last
      .then(() => this.switchTo(session, request))
      .catch((error: unknown): ServiceOpenResult => {
        log.error('could not open a service', error);
        return refused('failed');
      })
      .finally(() => {
        this.pending--;
      });
    this.last = result.then(() => undefined);
    return result;
  }

  private async switchTo(
    {content, feed}: ServiceSession,
    {serviceId}: ServiceOpenRequest,
  ): Promise<ServiceOpenResult> {
    const {log, onServiceChanged} = this.options;
    const previousId = feed.current()?.id;
    const changed = await content.openService(serviceId, () => {
      feed.refresh();
      return Promise.resolve();
    });
    if (!changed.ok) {
      log.warn('could not open a service', changed.error);
      return refused(
        changed.error.reason === 'not-found' ? 'missing' : 'failed',
      );
    }
    if (previousId !== serviceId) onServiceChanged();
    await this.remember(serviceId);
    feed.refresh();
    const opened = feed.current();
    return opened === null ? refused('failed') : {ok: true, value: opened};
  }

  private async remember(serviceId: ServiceOpenRequest['serviceId']) {
    const {appConfig, log} = this.options;
    try {
      appConfig.setLastServiceId(serviceId);
      await appConfig.flush();
    } catch (error: unknown) {
      log.error('could not remember the open service', error);
    }
  }
}

/** Answers the reads of the open 예배 순서 and the switches to another one. */
export function registerServiceChannels(
  loading: Promise<ServiceSession | null>,
  appConfig: ServiceSwitchOptions['appConfig'],
  {
    log,
    onServiceChanged = () => undefined,
  }: {
    readonly log: Logger;
    readonly onServiceChanged?: (() => void) | undefined;
  },
) {
  const ipc = new IpcHost(log);
  const switches = new ServiceSwitches({appConfig, log, onServiceChanged});
  let disposed = false;
  let closing: Promise<void> | null = null;
  const ready = loading.catch((error: unknown) => {
    log.error('could not open service channels', error);
    return null;
  });
  ipc.query(serviceEndpoints.get, async () => {
    const opened = await ready;
    if (disposed || opened === null) return null;
    opened.feed.refresh();
    return opened.feed.current();
  });
  ipc.request(serviceEndpoints.open, async request => {
    const opened = await ready;
    return disposed || opened === null
      ? refused('failed')
      : switches.open(opened, request);
  });
  return {
    /** Stops answering, and waits for the switches that were accepted. */
    dispose: (): Promise<void> => {
      disposed = true;
      ipc.close();
      closing ??= switches.ended();
      return closing;
    },
  };
}
