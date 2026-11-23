import {useState} from 'react';
import type {RecentPassage} from '@core/schema/bible';
import type {TranslationId} from '@core/schema/ids';

/**
 * A whole passage chosen in the 성경 구절 fields at once, such as a recent
 * one, and the translation it is read in. When the translation the fields
 * are given changes, the chosen passage follows it.
 */
export function useChosenRecent(provided: TranslationId | undefined) {
  const [chosen, setChosen] = useState<{
    readonly provided: TranslationId | undefined;
    readonly value: RecentPassage;
  } | null>(null);
  if (chosen && chosen.provided !== provided) {
    setChosen({
      provided,
      value: {
        ...chosen.value,
        translation: provided ?? chosen.value.translation,
      },
    });
  }
  const recent = chosen?.value;
  return {
    recent,
    /** The translation to read: the chosen passage's, else the given one. */
    translation:
      chosen?.provided === provided && provided !== undefined
        ? (recent?.translation ?? provided)
        : provided,
    /** Chooses a whole passage, or none to read the fields again. */
    choose: (value: RecentPassage | null): void =>
      setChosen(value === null ? null : {provided, value}),
  };
}
