import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type JSX,
} from 'react';
import type {PreferencesRequest} from '@contracts/ipc/window';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {
  PreferencesView,
  type PreferencesViewHandle,
} from '@renderer/features/preferences/PreferencesView';

type OpenPage = (page: PreferencePageId) => void;

interface PreferencesHarnessProps extends Omit<
  ComponentProps<typeof PreferencesView>,
  'request' | 'onReady' | 'onPageSelect' | 'viewRef'
> {
  readonly first?: PreferencesRequest;
  readonly onReady?: (request: PreferencesRequest) => void;
  /** Given a function that asks for a page from outside the view. */
  readonly opener?: (open: OpenPage) => void;
}

const FIRST: PreferencesRequest = {requestId: 1, page: 'general'};

/**
 * Shows the preferences view as the settings window does: a page that is asked
 * for comes up once the page before it has saved its drafts.
 */
export function PreferencesHarness({
  first = FIRST,
  onReady = () => undefined,
  opener,
  ...props
}: PreferencesHarnessProps): JSX.Element {
  const [request, setRequest] = useState(first);
  const view = useRef<PreferencesViewHandle>(null);
  const next = useRef<PreferencePageId | null>(null);
  const busy = useRef(false);
  const open = useCallback((page: PreferencePageId): void => {
    const run = async (): Promise<void> => {
      busy.current = true;
      while (next.current !== null) {
        const wanted = next.current;
        next.current = null;
        const settled = (await view.current?.settle()) ?? true;
        if (!settled || next.current !== null) continue;
        setRequest(last => ({requestId: last.requestId + 1, page: wanted}));
      }
      busy.current = false;
    };
    next.current = page;
    if (!busy.current) run().catch(() => undefined);
  }, []);
  useEffect(() => opener?.(open), [opener, open]);
  return (
    <PreferencesView
      {...props}
      request={request}
      onReady={onReady}
      onPageSelect={open}
      viewRef={view}
    />
  );
}
