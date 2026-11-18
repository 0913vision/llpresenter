import {useEffect, useState} from 'react';
import {
  defaultSlideTransitions,
  type SlideTransitionDefaults,
} from '@core/schema/preferences';

/** Follows the saved defaults while an editor is open. */
export function useSlideDefaults(): SlideTransitionDefaults {
  const [defaults, setDefaults] = useState(defaultSlideTransitions);
  useEffect(() => {
    const api = window.llp?.preferences;
    if (api === undefined) return undefined;
    let active = true;
    let received = false;
    const stop = api.subscribe(value => {
      received = true;
      if (active) setDefaults(value.show.slideDefaults);
    });
    api
      .get()
      .then(value => {
        if (active && !received) setDefaults(value.show.slideDefaults);
      })
      .catch((error: unknown) =>
        console.error('Could not load slide defaults', error),
      );
    return () => {
      active = false;
      stop();
    };
  }, []);
  return defaults;
}
