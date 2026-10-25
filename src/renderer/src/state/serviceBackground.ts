import type {LlpApi} from '@shared/ipc';
import type {Result} from '@shared/result';
import type {EditFailure, EditSuccess} from '@shared/schema/contentEdit';
import type {MediaId} from '@shared/schema/ids';
import {isItemOfKind} from '@shared/schema/service';

interface BackgroundChange {
  readonly serviceId: string;
  readonly itemId: string;
  readonly mediaId: MediaId | null;
}

interface RequestFailure {
  readonly reason: 'request-failed';
  readonly message: string;
}

export type BackgroundEditResult = Result<
  EditSuccess,
  EditFailure | RequestFailure
>;
type BackgroundApi = Pick<LlpApi, 'services' | 'content'>;

/** Saves this item's override, or removes it with null to inherit the song default. */
export async function updateServiceBackground(
  api: BackgroundApi,
  change: BackgroundChange,
): Promise<BackgroundEditResult> {
  try {
    const document = await api.services.get(change.serviceId);
    if (document?.service.id !== change.serviceId) {
      return {
        ok: false,
        error: {reason: 'not-found', message: 'The service no longer exists'},
      };
    }
    if (document.access === 'readOnly') {
      return {
        ok: false,
        error: {reason: 'read-only', message: 'The service is read-only'},
      };
    }
    const item = document.service.order.find(row => row.id === change.itemId);
    if (item === undefined || !isItemOfKind(item, 'song')) {
      return {
        ok: false,
        error: {reason: 'not-found', message: 'The song item no longer exists'},
      };
    }
    if ((item.background ?? null) === change.mediaId) {
      return {
        ok: true,
        value: {id: document.service.id, revision: document.revision},
      };
    }
    const updated = {...item};
    if (change.mediaId === null) delete updated.background;
    else updated.background = change.mediaId;
    return await api.content.edit({
      type: 'service.update',
      baseRevision: document.revision,
      service: {
        ...document.service,
        order: document.service.order.map(row =>
          row.id === change.itemId ? updated : row,
        ),
      },
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        reason: 'request-failed',
        message: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }
}
