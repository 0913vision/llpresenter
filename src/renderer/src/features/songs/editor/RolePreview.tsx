import type {JSX, ReactNode} from 'react';
import type {PreviewScreen} from '@renderer/ui/PreviewFrame';
import {PreviewPanel} from '@renderer/ui/PreviewPanel';
import {PREVIEW_ROLES, type PreviewRole} from './songPreviewModel';

const SCREENS: ReadonlyArray<PreviewScreen<PreviewRole>> = PREVIEW_ROLES.map(
  role => ({id: role.value, name: role.label, status: {kind: 'on'}}),
);

/** Local item pictures use the same panel as live monitoring. */
export function RolePreview({
  big,
  onBigChange,
  renderRole,
  caption,
  blank = false,
  children,
}: {
  readonly big: PreviewRole;
  readonly onBigChange: (role: PreviewRole) => void;
  readonly renderRole: (role: PreviewRole) => ReactNode;
  readonly caption: (role: PreviewRole) => ReactNode;
  readonly blank?: boolean;
  /** Rows under the picture area; mark each with `data-preview-extra`. */
  readonly children?: ReactNode;
}): JSX.Element {
  return (
    <PreviewPanel
      screens={SCREENS}
      big={big}
      blank={blank}
      onBigChange={onBigChange}
      renderScreen={screen => renderRole(screen.id)}
      caption={screen => caption(screen.id)}
    >
      {children}
    </PreviewPanel>
  );
}
