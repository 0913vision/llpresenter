import type {Screen} from '@core/schema/screens/screens';
import type {JSX} from 'react';
import {alwaysOnTopOf, onDisconnectOf} from '@core/screens';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {PropertyGroup, PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import type {OnScreenChange} from './screenPropertyParts';

const DISCONNECT_OPTIONS = [
  {value: 'window', label: '창으로 바꾸기'},
  {value: 'off', label: '출력 끄기'},
] as const;

/** The 안정성 group of a 화면: what happens when its monitor disconnects, and 항상 위. */
export function StabilityRows({
  screen,
  change,
  reason,
}: {
  readonly screen: Screen;
  readonly change: OnScreenChange;
  readonly reason: string | undefined;
}): JSX.Element {
  return (
    <PropertyGroup title="안정성">
      {screen.method === 'fullscreen' && (
        <PropertyRow label="연결이 끊기면">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              disabled={reason !== undefined}
              title={reason}
              block
              menuLabel="연결이 끊기면"
              options={DISCONNECT_OPTIONS}
              value={onDisconnectOf(screen)}
              onChange={onDisconnect => change({onDisconnect})}
            />
          )}
        </PropertyRow>
      )}
      <PropertyRow label="항상 위">
        {({controlId}) => (
          <Checkbox
            id={controlId}
            disabled={reason !== undefined}
            title={reason}
            checked={alwaysOnTopOf(screen)}
            onChange={alwaysOnTop => change({alwaysOnTop})}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}
