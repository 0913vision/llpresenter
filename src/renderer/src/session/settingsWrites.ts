import type {LlpApi} from '@contracts/ipc/api';
import type {EditResult} from '@core/schema/contentEdit';
import type {
  SettingsDocument,
  SettingsEdit,
  SettingsName,
} from '@core/schema/settingsDocuments';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {withinLookupTimeout} from './showOutput';

/** How many times in all an edit is planned and sent while other writes come first. */
const ATTEMPTS = 2;

export type SettingsDocumentOf<N extends SettingsName> = Extract<
  SettingsDocument,
  {name: N}
>;

function isSettings<N extends SettingsName>(
  document: SettingsDocument,
  name: N,
): document is SettingsDocumentOf<N> {
  return document.name === name;
}

/** The stored settings file `name`, read afresh. */
export async function readSettings<N extends SettingsName>(
  api: Pick<LlpApi, 'settings'>,
  name: N,
): Promise<SettingsDocumentOf<N>> {
  const document = await withinLookupTimeout(() => api.settings.get({name}));
  if (!isSettings(document, name)) {
    throw new Error(`The reply is not the ${name} settings`);
  }
  return document;
}

/** The stored settings file `name`; it throws when the file can't be edited. */
export async function editableSettings<N extends SettingsName>(
  api: Pick<LlpApi, 'settings'>,
  name: N,
): Promise<SettingsDocumentOf<N>> {
  const document = await readSettings(api, name);
  if (document.access !== 'editable') {
    throw new Error(`The ${name} settings cannot be edited`);
  }
  return document;
}

/** The answer of a plan with nothing to write: the stored revision. */
export function unchangedSettings(
  document: SettingsDocument,
  id: string = document.name,
): EditResult {
  return {ok: true, value: {id, revision: document.revision}};
}

/**
 * Sends a settings edit that reads before it writes. `plan` reads the stored
 * file and answers the edit to send, or the result when nothing is written.
 * When another write came first, the edit is planned and sent again. The
 * write waits in the pending writes, so a close waits for it; once writing
 * stopped for a close, it throws.
 */
export function writeSettings(
  api: LlpApi,
  plan: () => Promise<SettingsEdit | EditResult>,
): Promise<EditResult> {
  return gatedSettingsWrite(api, () => sendPlanned(api, plan));
}

/**
 * Runs one settings write in the pending writes, so a close waits for it;
 * once writing stopped for a close, it throws.
 */
export async function gatedSettingsWrite(
  api: LlpApi,
  write: () => Promise<EditResult>,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write,
    refused: null,
    sent: outcome =>
      outcome !== null &&
      (outcome.ok || outcome.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Settings edits stopped for closing');
  return result;
}

async function sendPlanned(
  api: LlpApi,
  plan: () => Promise<SettingsEdit | EditResult>,
  attempt = 0,
): Promise<EditResult> {
  const planned = await plan();
  if ('ok' in planned) return planned;
  const result = await api.settings.edit(planned);
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < ATTEMPTS) {
    return sendPlanned(api, plan, attempt + 1);
  }
  throw new Error(result.error.message);
}
