import {SCREEN_NAME_PROBLEMS} from '../screenEditor';
import type {Screen} from '@core/schema/screens/screens';
import {useState, type JSX} from 'react';
import {nameProblem} from '@core/screens';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {TextField} from '@renderer/ui/fields/TextField';
import {isComposing} from '@renderer/ui/fields/ime';
import {hasModifier} from '@renderer/ui/keys/modifierKeys';

/** The 이름 row of a 화면, renamed in place. */
export function NameRow({
  screen,
  screens,
  rename,
  reason,
}: {
  readonly screen: Screen;
  readonly screens: readonly Screen[];
  readonly rename: (name: string) => void;
  readonly reason: string | undefined;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? screen.name;
  const problem = nameProblem(shown, screens, screen.id);
  const commit = (): void => {
    if (reason === undefined && problem === undefined && draft !== null) {
      rename(shown.trim());
    }
    setDraft(null);
  };
  return (
    <PropertyRow label="이름">
      {({controlId}) => (
        <TextField
          id={controlId}
          maxLength={NAME_LIMIT}
          readOnly={reason !== undefined}
          aria-disabled={reason !== undefined ? true : undefined}
          title={reason}
          block
          value={shown}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={event => {
            if (
              event.key === 'Enter' &&
              !isComposing(event) &&
              !hasModifier(event)
            ) {
              event.currentTarget.blur();
            }
          }}
          invalid={problem !== undefined}
          invalidReason={
            problem === undefined ? undefined : SCREEN_NAME_PROBLEMS[problem]
          }
        />
      )}
    </PropertyRow>
  );
}
