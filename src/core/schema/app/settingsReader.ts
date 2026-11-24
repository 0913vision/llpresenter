import type {Preferences} from './preferences';
import type {SettingsDocument, SettingsName} from './settingsDocuments';

/** Called with each settings document that changes. */
export type SettingsListener = (document: SettingsDocument) => void;

/** Reads the current settings documents and follows their changes. */
export interface SettingsReader {
  /** The current document. Throws when it is unavailable. */
  get(name: SettingsName): SettingsDocument;
  /** The preferences, with defaults for the fields a file leaves out. */
  preferences(): Preferences;
  /** @returns A function that removes the listener. Always call it. */
  subscribe(listener: SettingsListener): () => void;
}
