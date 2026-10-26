import {useEffect, useMemo, useState, type JSX} from 'react';
import {isKnownQuickItem, type QuickItemKind} from '@shared/schema/quick';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {ListActionRow} from '@renderer/ui';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  PanelTools,
} from '@renderer/ui/Panel';
import type {Notice} from '@renderer/ui/notices';
import {BibleQuickField} from './BibleQuickField';
import {quickItemOn, quickItemUnavailable, quickRunner} from './quickActions';
import styles from './QuickPanel.module.css';

const icons: Readonly<Record<QuickItemKind, string>> = {
  song: 'song',
  bible: 'book',
  prop: 'prop',
  timer: 'timer',
  macro: 'macro',
  black: 'monitor',
};

export function QuickPanel({
  selectionVersion,
  onProblem,
}: {
  readonly selectionVersion: number;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const api = window.llp;
  const document = useSettingsDocument('quick', '퀵 실행', onProblem);
  const live = useLive(view => view.state);
  const [activationVersion, setActivationVersion] = useState(0);
  const runner = useMemo(
    () => (api ? quickRunner(api, onProblem) : null),
    [api, onProblem],
  );
  useEffect(() => () => runner?.cancel(), [runner, selectionVersion, document]);
  useEffect(
    () =>
      useShow.subscribe((next, previous) => {
        if (
          next.openItemId !== previous.openItemId ||
          next.selectedTile !== previous.selectedTile
        ) {
          runner?.cancel();
        }
      }),
    [runner],
  );
  if (api === undefined) return null;
  return (
    <Panel label="퀵 실행" className={styles.panel}>
      <PanelHeader>
        <PanelTitle title="퀵 실행" />
      </PanelHeader>
      <PanelTools>
        <div onChangeCapture={() => runner?.cancel()}>
          <BibleQuickField
            api={api}
            selectionVersion={selectionVersion + activationVersion}
          />
        </div>
      </PanelTools>
      <PanelBody variant="flush">
        <div role="group" aria-label="퀵 실행 항목">
          {document?.value.items.map(item => {
            const known = isKnownQuickItem(item);
            const reason = quickItemUnavailable(item);
            const available = known && reason === undefined;
            return (
              <ListActionRow
                key={item.id}
                title={item.name}
                icon={known ? icons[item.kind] : 'warning'}
                pressed={known ? quickItemOn(item, live) : undefined}
                disabled={!available}
                reason={reason}
                onPress={() => {
                  if (available) {
                    setActivationVersion(value => value + 1);
                    runner
                      ?.run(item)
                      .catch((cause: unknown) =>
                        console.error('Quick item callback failed:', cause),
                      );
                  }
                }}
              />
            );
          })}
        </div>
      </PanelBody>
    </Panel>
  );
}
