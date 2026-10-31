import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ThemeElement} from '@core/schema/themes';
export function useThemeSelection(
  scope: string,
  visibleElements: readonly ThemeElement[],
) {
  const [selected, setSelected] = useState<{
    scope: string;
    ids: readonly string[];
  }>({scope: '', ids: []});

  const [tab, setTab] = useState<'element' | 'screen'>('screen');

  const [keepRatio, setKeepRatio] = useState(false);

  const [snapGrid, setSnapGrid] = useState(false);

  const [focusRequest, setFocusRequest] = useState<{
    scope: string;
    id: string | null;
  } | null>(null);

  const mounted = useRef(true);

  const selectionEpoch = useRef(0);

  const selectionScope = useRef('');

  const interactionEpoch = useRef(0);

  useEffect(() => {
    const interacted = (): void => {
      interactionEpoch.current++;
    };
    const events = ['pointerdown', 'click', 'keydown'] as const;
    for (const event of events) {
      window.addEventListener(event, interacted, true);
    }
    return () => {
      for (const event of events) {
        window.removeEventListener(event, interacted, true);
      }
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    selectionScope.current = scope;
  }, [scope]);

  const selectedIds = (selected.scope === scope ? selected.ids : []).filter(
    id => visibleElements.some(element => element.id === id),
  );

  const selectMany = (ids: readonly string[]): void => {
    setFocusRequest(null);
    selectionEpoch.current++;
    setSelected({scope, ids});
    setTab(ids.length === 0 ? 'screen' : 'element');
  };

  const select = (id: string | null): void =>
    selectMany(id === null ? [] : [id]);

  const guardSelection = (): (() => boolean) => {
    const epoch = selectionEpoch.current;
    const capturedScope = selectionScope.current;
    return () =>
      mounted.current &&
      selectionEpoch.current === epoch &&
      selectionScope.current === capturedScope;
  };

  const guardInteraction = (): (() => boolean) => {
    const unchanged = guardSelection();
    const epoch = interactionEpoch.current;
    return () => unchanged() && interactionEpoch.current === epoch;
  };
  return {
    selectedIds,
    focusRequest: focusRequest?.scope === scope ? focusRequest : null,
    keepRatio,
    setKeepRatio,
    snapGrid,
    setSnapGrid,
    tab,
    setTab,
    select,
    guardSelection,
    guardInteraction,
    selectAll: () => {
      selectMany(visibleElements.map(element => element.id));
    },
    selectMany,
    focus: (id: string | null) => setFocusRequest({scope, id}),
  };
}
export type ThemeSelection = ReturnType<typeof useThemeSelection>;
