import type {LlpApi} from '@shared/ipc';
import type {
  SettingsDocument,
  SettingsName,
} from '@shared/schema/settingsDocuments';

interface SettingsFeedOptions<TValue> {
  readonly settings: LlpApi['settings'];
  readonly name: SettingsName;
  /** The value of the followed document, or undefined for any other one. */
  readonly select: (document: SettingsDocument) => TValue | undefined;
  readonly receive: (value: TValue) => void;
  readonly onError: (error: unknown) => void;
}

/**
 * Follows one settings document: subscribes first, then reads it, and never
 * lets an older revision replace a newer one.
 *
 * @returns A function that stops following; later replies are dropped.
 */
export function followSettingsDocument<TValue>(
  options: SettingsFeedOptions<TValue>,
): () => void {
  let disposed = false;
  let revision = -1;
  const receive = (document: SettingsDocument): void => {
    if (disposed || document.revision < revision) return;
    const value = options.select(document);
    if (value === undefined) return;
    revision = document.revision;
    options.receive(value);
  };
  const unsubscribe = options.settings.subscribe(receive);
  void options.settings
    .get({name: options.name})
    .then(receive)
    .catch((error: unknown) => {
      if (!disposed) options.onError(error);
    });
  return () => {
    disposed = true;
    unsubscribe();
  };
}
