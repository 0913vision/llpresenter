import {useEffect, useState} from 'react';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import type {Notice} from '@renderer/ui/notices';

type LooksDocument = Extract<SettingsDocument, {name: 'looks'}>;

/** Reads D2's Look choices while the menu is open; settings are not live confirmation. */
export function useLookChoices({
  open,
  onProblem,
}: {
  readonly open: boolean;
  readonly onProblem: (notice: Notice) => void;
}) {
  const [document, setDocument] = useState<LooksDocument | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const api = window.llp;
    if (!open || !api) return undefined;
    let active = true;
    let revision = -1;
    const accept = (next: SettingsDocument): void => {
      if (!active || next.name !== 'looks' || next.revision <= revision) return;
      revision = next.revision;
      setDocument(next);
      setLoading(false);
    };
    const stop = api.settings.subscribe(accept);
    api.settings.get({name: 'looks'}).then(accept, (cause: unknown) => {
      api.log.write({
        level: 'error',
        message: 'Could not load the Look choices',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (!active || revision >= 0) return;
      setLoading(false);
      onProblem({
        key: 'toolbar-look:load',
        kind: 'warning',
        icon: 'warning',
        title: 'Look 불러오기 실패',
        time: new Date().toTimeString().slice(0, 5),
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, [open, onProblem]);
  const prepare = (): void => {
    setDocument(null);
    setLoading(true);
  };
  return {document, loading, prepare};
}
