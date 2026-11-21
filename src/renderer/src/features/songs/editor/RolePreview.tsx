import {useState, type JSX, type ReactNode} from 'react';
import type {Screen} from '@core/schema/screens';
import {PreviewPanel} from '@renderer/ui/PreviewPanel';
import {PREVIEW_ROLES, type PreviewRole} from './songPreviewModel';

interface Shared {
  readonly blank?: boolean;
  readonly naturalHeight?: boolean;
  readonly children?: ReactNode;
}
type Configured = Shared & {
  readonly screens: readonly Screen[];
  readonly big: string | null;
  readonly onBigChange: (id: string) => void;
  readonly renderScreen: (screen: Screen) => ReactNode;
};
type Legacy = Shared & {
  readonly screens?: never;
  readonly big: PreviewRole;
  readonly onBigChange: (role: PreviewRole) => void;
  readonly renderRole: (role: PreviewRole) => ReactNode;
  readonly caption: (role: PreviewRole) => ReactNode;
};

/** Local item pictures use the same panel as live monitoring. */
export function RolePreview(props: Configured | Legacy): JSX.Element | null {
  const [visible, setVisible] = useState(true);
  if (props.screens === undefined) {
    const screens = PREVIEW_ROLES.map(role => ({
      id: role.value,
      name: role.label,
      status: {kind: 'on' as const},
    }));
    return (
      <PreviewPanel
        screens={screens}
        big={props.big}
        onBigChange={props.onBigChange}
        blank={props.blank ?? false}
        naturalHeight={props.naturalHeight ?? false}
        alwaysShowTiles
        visible={visible}
        onVisibleChange={setVisible}
        renderScreen={screen => props.renderRole(screen.id)}
        caption={screen => props.caption(screen.id)}
      >
        {props.children}
      </PreviewPanel>
    );
  }
  const {screens, big, onBigChange, renderScreen} = props;
  const target =
    screens.find(screen => screen.id === big) ??
    screens.find(screen => screen.kind === 'audience') ??
    screens[0];
  if (target === undefined) return null;
  return (
    <PreviewPanel
      screens={screens.map(screen => ({
        id: screen.id,
        name: screen.name,
        status: {kind: 'on' as const},
      }))}
      big={target.id}
      blank={props.blank ?? false}
      alwaysShowTiles
      naturalHeight={props.naturalHeight ?? false}
      visible={visible}
      onVisibleChange={setVisible}
      onBigChange={onBigChange}
      renderScreen={screen => {
        const targetScreen = screens.find(
          candidate => candidate.id === screen.id,
        );
        return targetScreen === undefined ? null : renderScreen(targetScreen);
      }}
      caption={screen => screen.name}
    >
      {props.children}
    </PreviewPanel>
  );
}
