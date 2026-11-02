import type {JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {OrderEditorTarget} from '@core/schema/ipcPayloads';
import {isItemOfKind, type ServiceItemOf} from '@core/schema/service';
import type {Label} from '@core/schema/labels';
import type {Notice} from '@renderer/ui/notices';
import {OrderEditor} from './OrderEditor';
import {useFollowedService, useFollowedSong} from './useOrderEditorSources';

type ViewApi = Pick<
  LlpApi,
  'orderEditor' | 'content' | 'services' | 'songs' | 'window'
>;

interface ViewProps {
  readonly api: ViewApi;
  readonly target: OrderEditorTarget;
  readonly labels: readonly Label[];
  readonly onProblem: (notice: Notice) => void;
}

function SongView({
  api,
  target,
  item,
  serviceReadOnly,
  labels,
  onProblem,
}: ViewProps & {
  readonly item: ServiceItemOf<'song'>;
  readonly serviceReadOnly: boolean;
}): JSX.Element | null {
  const {document, reload} = useFollowedSong(api, item.song);
  if (document === null) return null;
  return (
    <OrderEditor
      api={api}
      target={target}
      item={item}
      document={document}
      serviceReadOnly={serviceReadOnly}
      labels={labels}
      onProblem={onProblem}
      reloadSong={reload}
    />
  );
}

/**
 * Follows the 예배 순서 file and the song of the target item, and shows the
 * editor while both exist. Mount it with a key of the target, because a
 * followed document never goes back to an older revision.
 */
export function OrderEditorTargetView(props: ViewProps): JSX.Element | null {
  const service = useFollowedService(props.api, props.target.serviceId);
  const item = service?.service.order.find(
    entry => entry.id === props.target.itemId,
  );
  if (service === null || item === undefined || !isItemOfKind(item, 'song')) {
    return null;
  }
  return (
    <SongView
      key={item.song}
      {...props}
      item={item}
      serviceReadOnly={service.access === 'readOnly'}
    />
  );
}
