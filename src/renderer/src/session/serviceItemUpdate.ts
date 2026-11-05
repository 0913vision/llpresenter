import type {ServiceItemChange} from '@core/services/itemFieldChanges';
import type {LlpApi} from '@contracts/ipc/api';
import type {Result} from '@core/common/result';
import type {EditFailure, EditSuccess} from '@core/schema/contentEdit';
import {isItemOfKind} from '@core/schema/service';
import type {Service} from '@core/schema/service';
import {recordItemEdit} from './serviceOrderEdits';

interface RequestFailure {
  readonly reason: 'request-failed';
  readonly message: string;
}

export type ServiceItemEditResult = Result<
  EditSuccess,
  EditFailure | RequestFailure
>;
export type ServiceItemApi = Pick<LlpApi, 'services' | 'content'>;

export type {ServiceItemChange} from '@core/services/itemFieldChanges';

/** The same item-only arrangement choice in its setting and context menu. */
export function itemArrangementChange(
  name: string | undefined,
): ServiceItemChange {
  return item => {
    if (!isItemOfKind(item, 'song')) return null;
    if (item.arrangement === name) return item;
    const updated = {...item};
    if (name === undefined) delete updated.arrangement;
    else updated.arrangement = name;
    return updated;
  };
}

export interface ServiceItemUpdate {
  readonly serviceId: string;
  readonly itemId: string;
  readonly change: ServiceItemChange;
  readonly onApplied?: (entry: {
    readonly before: Service;
    readonly after: Service;
  }) => void;
}

function refuse(
  reason: 'not-found' | 'read-only',
  message: string,
): ServiceItemEditResult {
  return {ok: false, error: {reason, message}};
}

/**
 * Changes one 예배 순서 item's own fields against the service's fresh
 * revision. The rest of the service and every unknown field stay as read.
 */
export async function updateServiceItem(
  api: ServiceItemApi,
  {serviceId, itemId, change, onApplied}: ServiceItemUpdate,
): Promise<ServiceItemEditResult> {
  try {
    const document = await api.services.get(serviceId);
    if (document?.service.id !== serviceId) {
      return refuse('not-found', 'The service no longer exists');
    }
    if (document.access === 'readOnly') {
      return refuse('read-only', 'The service is read-only');
    }
    const item = document.service.order.find(row => row.id === itemId);
    const updated = item === undefined ? null : change(item);
    if (updated === null) {
      return refuse('not-found', 'The item no longer takes this change');
    }
    if (updated === item) {
      return {
        ok: true,
        value: {id: document.service.id, revision: document.revision},
      };
    }
    const order = document.service.order.map(row =>
      row.id === itemId ? updated : row,
    );
    const saved = await api.content.edit({
      type: 'service.update',
      baseRevision: document.revision,
      service: {...document.service, order},
    });
    if (saved.ok || saved.error.reason === 'write-failed') {
      recordItemEdit(api, {
        serviceId: document.service.id,
        before: document.service.order,
        after: order,
      });
      onApplied?.({
        before: document.service,
        after: {...document.service, order},
      });
    }
    return saved;
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
