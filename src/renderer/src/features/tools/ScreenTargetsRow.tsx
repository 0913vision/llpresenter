import type {JSX} from 'react';
import {Button, PropertyRow} from '@renderer/ui';
import styles from './ScreenTargetsRow.module.css';

/** The screens a message or graphic goes to: every screen, or the ones named. */
export type ScreenTargets<Id extends string> = readonly Id[] | 'all';

/** Turns one screen on or off; from 모든 화면 it leaves that screen alone on. */
function toggled<Id extends string>(
  targets: ScreenTargets<Id>,
  id: Id,
): ScreenTargets<Id> {
  if (targets === 'all') return [id];
  return targets.includes(id)
    ? targets.filter(value => value !== id)
    : [...targets, id];
}

/**
 * 보낼 화면: a toggle for each screen, and first 모든 화면 when `all` is on,
 * which also covers the screens made later.
 */
export function ScreenTargetsRow<Id extends string>({
  screens,
  targets,
  onChange,
  all = true,
  locked = false,
}: {
  readonly screens: ReadonlyArray<{readonly id: Id; readonly name: string}>;
  readonly targets: ScreenTargets<Id>;
  readonly onChange: (targets: ScreenTargets<Id>) => void;
  readonly all?: boolean;
  readonly locked?: boolean;
}): JSX.Element {
  return (
    <PropertyRow label="보낼 화면" alignTop>
      {({controlId}) => (
        <div
          id={controlId}
          role="group"
          aria-label="보낼 화면"
          className={styles.targets}
        >
          {all ? (
            <Button
              disabled={locked}
              aria-pressed={targets === 'all'}
              onClick={() => onChange(targets === 'all' ? [] : 'all')}
            >
              모든 화면
            </Button>
          ) : null}
          {screens.map(screen => (
            <Button
              key={screen.id}
              disabled={locked}
              aria-pressed={targets !== 'all' && targets.includes(screen.id)}
              onClick={() => onChange(toggled(targets, screen.id))}
            >
              {screen.name || '이름 없음'}
            </Button>
          ))}
        </div>
      )}
    </PropertyRow>
  );
}
