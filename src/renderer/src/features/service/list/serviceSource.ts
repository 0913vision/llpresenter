import type {ServiceId, TemplateId} from '@core/schema/common/ids';

/** Where a new service's items come from. */
export type ServiceSource =
  | {readonly kind: 'empty'}
  | {readonly kind: 'template'; readonly id: TemplateId}
  | {readonly kind: 'service'; readonly id: ServiceId};
