import type {LlpApi} from '@shared/ipc';
import type {Screen} from '@shared/schema/screens';
import type {RenderScreen} from './layer';
import {resolveOutputScreen} from '@shared/screens';

/** Uses the same configured and starter identities as the main output backend. */
export function resolveRenderScreen(
  id: string,
  screens: readonly Screen[],
): RenderScreen | undefined {
  const screen = resolveOutputScreen(id, screens);
  return screen === undefined
    ? undefined
    : {id: screen.id, kind: screen.kind, method: screen.method};
}

/** Follows routing identity without letting an old read override a newer edit. */
export function followRenderScreen(options: {
  readonly settings: LlpApi['settings'];
  readonly id: string;
  readonly receive: (screen: RenderScreen | undefined) => void;
  readonly onError: (message: string, error: unknown) => void;
}): () => void {
  let disposed = false;
  let revision = -1;
  const receive = (
    document: Awaited<ReturnType<LlpApi['settings']['get']>>,
  ): void => {
    if (
      disposed ||
      document.name !== 'screens' ||
      document.revision < revision
    ) {
      return;
    }
    revision = document.revision;
    options.receive(resolveRenderScreen(options.id, document.value.screens));
  };
  const unsubscribe = options.settings.subscribe(receive);
  void options.settings
    .get({name: 'screens'})
    .then(receive)
    .catch((error: unknown) => {
      if (!disposed) {
        options.onError('could not read output screen identity', error);
      }
    });
  return () => {
    disposed = true;
    unsubscribe();
  };
}
