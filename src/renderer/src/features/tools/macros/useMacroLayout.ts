import {useEffect, useRef, useState} from 'react';
import type {MacroCollection} from '@core/schema/tools/macros';
import type {MacroViewMode} from './MacroView';

type CollectionId = MacroCollection['id'];

/**
 * The grid or list and the 모음 the 매크로 tab shows, kept in the UI state.
 * A choice made before the saved one is read wins over it.
 */
export function useMacroLayout() {
  const [mode, setMode] = useState<MacroViewMode>('grid');
  const [collection, setCollection] = useState<CollectionId>();
  const touchedView = useRef(false);
  const touchedCollection = useRef(false);
  useEffect(() => {
    let active = true;
    window.llp?.ui
      .get()
      .then(state => {
        if (!active) return;
        if (!touchedView.current && state.macroView !== undefined) {
          setMode(state.macroView);
        }
        if (!touchedCollection.current && state.macroCollection !== undefined) {
          setCollection(state.macroCollection);
        }
      })
      .catch((error: unknown) =>
        console.error('Could not restore macro view', error),
      );
    return () => {
      active = false;
    };
  }, []);
  return {
    mode,
    collection,
    changeMode: (value: MacroViewMode): void => {
      touchedView.current = true;
      setMode(value);
      window.llp?.ui.setRememberedView({macroView: value});
    },
    /** Shows a 모음 and remembers it; undefined shows 모든 매크로. */
    showCollection: (id: CollectionId | undefined): void => {
      touchedCollection.current = true;
      setCollection(id);
      window.llp?.ui.setRememberedView({macroCollection: id ?? null});
    },
    /** Shows a 모음 now and remembers it only once `saved` says it holds. */
    showUnsaved: (id: CollectionId, saved: Promise<boolean>): void => {
      touchedCollection.current = true;
      setCollection(id);
      saved.then(
        held => {
          if (held) window.llp?.ui.setRememberedView({macroCollection: id});
        },
        () => undefined,
      );
    },
    /** Puts back the 모음 shown before `id`, if `id` is still shown. */
    restoreCollection: (id: CollectionId, previous: CollectionId | undefined) =>
      setCollection(current => (current === id ? previous : current)),
    /** Leaves a deleted 모음 for 모든 매크로. */
    leaveCollection: (id: CollectionId): void => {
      if (collection === id) {
        touchedCollection.current = true;
        window.llp?.ui.setRememberedView({macroCollection: null});
      }
      setCollection(current => (current === id ? undefined : current));
    },
  };
}
