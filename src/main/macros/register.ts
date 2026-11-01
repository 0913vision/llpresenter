import {setImmediate} from 'node:timers/promises';
import type {MediaList} from '@core/schema/mediaList';
import type {ServiceItem} from '@core/schema/service';
import type {SettingsReader} from '@core/schema/settingsReader';
import {dispatchLogged, type LiveStore} from '../live/store';
import type {Logger} from '../log';
import {MacroRunner} from './runner';
import type {MacroPlan} from './types';

export interface MacroRegistration {
  readonly ready: Promise<void>;
  readonly lastRun: MacroPlan | null;
  readonly startFresh: () => Promise<void>;
  readonly dispose: () => void;
}

/** The parts of the data store that macros read. */
interface MacroData {
  readonly settings: Promise<SettingsReader | null>;
  readonly media: Promise<{get(): {readonly value: MediaList}} | null>;
  readonly content: Promise<{
    readonly openServiceId: string | null;
    service(
      id: string,
    ): {readonly service: {readonly order: readonly ServiceItem[]}} | null;
  } | null>;
}

interface RegisterMacrosOptions {
  readonly store: Pick<LiveStore, 'handles' | 'dispatch' | 'connectMacros'>;
  readonly data: MacroData;
  readonly log: Logger;
  readonly launch?: 'normal' | 'restore';
}

/** Connects after data is ready; O8 registers with restore mode and calls startFresh after that choice. */
export function registerMacros({
  store,
  data,
  log,
  launch = 'normal',
}: RegisterMacrosOptions): MacroRegistration {
  let disposed = false;
  let release: (() => void) | undefined;
  let runner: MacroRunner | null = null;
  let starting: Promise<void> | null = null;
  const isDisposed = (): boolean => disposed;
  const runStartup = async (): Promise<void> => {
    if (isDisposed()) return;
    if (runner === null) throw new Error('Macro runtime is unavailable');
    for (const macroId of runner.startupIds()) {
      if (isDisposed()) return;
      dispatchLogged(store, {type: 'macro.run', macroId}, log);
      await setImmediate();
    }
  };
  const startup = (): Promise<void> => {
    starting ??= runStartup().finally(() => {
      starting = null;
    });
    return starting;
  };
  const ready = Promise.all([data.settings, data.media, data.content])
    .then(async ([settings, media, content]) => {
      if (disposed) return;
      if (settings === null || media === null || content === null) {
        throw new Error('Macro data is unavailable');
      }
      runner = new MacroRunner({
        settings,
        media: () => media.get().value,
        item: id => {
          const openId = content.openServiceId;
          return openId === null
            ? undefined
            : content
                .service(openId)
                ?.service.order.find(item => item.id === id);
        },
        supports: type => store.handles(type),
        log,
      });
      release = store.connectMacros(runner);
      if (launch === 'normal') await startup();
    })
    .catch((error: unknown) =>
      log.error('could not connect macro execution', error),
    );
  return {
    ready,
    get lastRun() {
      return runner?.lastRun ?? null;
    },
    startFresh: async () => {
      await ready;
      await startup();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      release?.();
      release = undefined;
      runner = null;
    },
  };
}
