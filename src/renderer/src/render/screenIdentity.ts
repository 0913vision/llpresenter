import type {LlpApi} from '@shared/ipc';
import type {Screen} from '@shared/schema/screens';
import type {RenderScreen} from './layer';

/** Resolves the M2 output aliases until O3 supplies configured screen ids. */
export function resolveRenderScreen(
  id: string,
  screens: readonly Screen[],
): RenderScreen | undefined {
  const exact = screens.find(screen => screen.id === id);
  if (exact !== undefined) {
    return {id: exact.id, kind: exact.kind, method: exact.method};
  }
  const alias = screens.find(screen =>
    id === 'main'
      ? screen.kind === 'audience' && screen.method !== 'capture'
      : id === 'captions' || id === 'broadcast'
        ? screen.kind === 'audience' && screen.method === 'capture'
        : id === 'stage' && screen.kind === 'stage',
  );
  return alias === undefined
    ? undefined
    : {id: alias.id, kind: alias.kind, method: alias.method};
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
