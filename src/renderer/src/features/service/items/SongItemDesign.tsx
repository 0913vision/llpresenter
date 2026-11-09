import {useEffect, useState, useSyncExternalStore, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import {isItemOfKind} from '@core/schema/service';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SongDesignRenderer} from '@renderer/features/songs/editor/SongEditorRibbon';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {Button} from '@renderer/ui/Button';
import {ThemeCell} from '../table/ThemeCell';
import {BackgroundCell} from '../table/BackgroundCell';
import type {ItemTarget, ServiceItemStore} from './serviceItemStore';
import {backgroundRequest} from './itemPlaybackCommands';
import {useItemMedia, useItemSettings} from './useItemSources';
import styles from './SongItemDesign.module.css';

/** Supplies service-owned controls to either song editor host. */
export function songItemDesign(
  api: LlpApi,
  items: ServiceItemStore,
): SongDesignRenderer {
  return (session, busy) => {
    const target = session.document.itemTarget;
    return target === undefined ? null : (
      <SongItemDesign
        key={`${target.serviceId}:${target.itemId}`}
        api={api}
        items={items}
        session={session}
        target={target}
        title={session.title.value}
        disabled={busy}
      />
    );
  };
}

function useDesignSource(api: LlpApi, target: ItemTarget) {
  const [service, setService] = useState<ServiceDocument | null>(null);
  const [song, setSong] = useState<SongDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let revision = -1;
    let songRead = 0;
    const fail = (error: unknown): void => {
      if (!alive) return;
      console.error('Could not read the song item design', error);
      setFailed(true);
    };
    const readSong = (document: ServiceDocument | null): void => {
      const item = document?.service.order.find(
        row => row.id === target.itemId,
      );
      const turn = ++songRead;
      if (item === undefined || !isItemOfKind(item, 'song')) return;
      api.songs.get(item.song).then(value => {
        if (alive && songRead === turn) setSong(value);
      }, fail);
    };
    const accept = (document: ServiceDocument | null): void => {
      if (!alive || (document !== null && document.revision < revision)) return;
      revision = document?.revision ?? revision;
      setService(document);
      setFailed(false);
      readSong(document);
    };
    let pushed = false;
    const stopService = api.services.subscribe(change => {
      if (change.serviceId !== target.serviceId) return;
      pushed = true;
      accept(change.document);
    });
    const stopSong = api.songs.subscribe(() => {
      api.services.get(target.serviceId).then(accept, fail);
    });
    api.services.get(target.serviceId).then(document => {
      if (!pushed) accept(document);
    }, fail);
    return () => {
      alive = false;
      stopService();
      stopSong();
    };
  }, [api, target.serviceId, target.itemId, attempt]);
  return {service, song, failed, retry: () => setAttempt(value => value + 1)};
}

/** Shares the order's selectors and write queue for this editor's captured item. */
export function SongItemDesign({
  api,
  items,
  session,
  target,
  disabled,
  title,
}: {
  readonly api: LlpApi;
  readonly items: Pick<
    ServiceItemStore,
    'submitItemEdit' | 'subscribe' | 'getSnapshot'
  >;
  readonly session: Pick<SongSession, 'flush' | 'readOnly'>;
  readonly title: string;
  readonly target: ItemTarget;
  readonly disabled: boolean;
}): JSX.Element {
  const source = useDesignSource(api, target);
  const themes = useItemSettings(api.settings, 'themes');
  const media = useItemMedia(api.media);
  const itemState = useSyncExternalStore(items.subscribe, items.getSnapshot);
  const item = source.service?.service.order.find(
    row => row.id === target.itemId,
  );
  const themeFile =
    themes.document?.name === 'themes' ? themes.document.value : null;
  const background =
    item !== undefined && isItemOfKind(item, 'song')
      ? (item.background ?? source.song?.song.background)
      : undefined;
  const failed = source.failed || themes.failed || media.failed;
  const reason =
    session.readOnly || source.service?.access === 'readOnly'
      ? NEWER_FILE_REASON
      : disabled || itemState.busy
        ? '저장 중'
        : failed
          ? '디자인 불러오기 실패'
          : source.service === null ||
              themeFile === null ||
              media.document === null
            ? '불러오는 중'
            : undefined;
  const submit: Pick<ServiceItemStore, 'submitItemEdit'> = {
    submitItemEdit: async request => {
      if (reason !== undefined || !(await session.flush())) return false;
      return items.submitItemEdit(request);
    },
  };
  return (
    <div className={styles.ribbon}>
      {item !== undefined && isItemOfKind(item, 'song') ? (
        <>
          <div className={styles.group}>
            <span>테마</span>
            <ThemeCell
              item={item}
              themes={themeFile}
              target={target}
              items={submit}
              label="테마"
              reason={reason}
              presentation="ribbon"
            />
          </div>
          <div className={styles.group}>
            <span>배경</span>
            <BackgroundCell
              row={{
                kind: 'song',
                id: item.id,
                title,
                ...(background === undefined
                  ? {}
                  : {background: {mediaId: background, loop: false}}),
              }}
              rowLabel={title}
              item={item}
              media={media.document?.value.items ?? []}
              songBackground={source.song?.song.background}
              reason={reason}
              presentation="ribbon"
              choose={value =>
                editorTask(
                  submit.submitItemEdit(backgroundRequest(target, value)),
                )
              }
            />
          </div>
        </>
      ) : null}
      {failed ? (
        <Button
          onClick={() => {
            source.retry();
            themes.retry();
            media.retry();
          }}
        >
          다시 불러오기
        </Button>
      ) : null}
    </div>
  );
}
