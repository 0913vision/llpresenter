import {useEffect, useMemo, useRef, useState} from 'react';
import type {ServiceEntry} from '@core/schema/services/contentDocuments';
import {applyService, useShow} from '@renderer/session/show';
import {useServiceSwitchGuard} from '../useServiceSwitchGuard';
import {noticeTime, type Notice} from '@renderer/ui/popups/notices';
import {serviceDay} from '@core/services';

const names = new Intl.Collator('ko', {numeric: true});
const problemTitles = {
  load: '예배 목록 불러오기 실패',
  open: '예배 열기 실패',
  missing: '예배를 찾을 수 없음',
  busy: '예배를 여는 중',
};

function problemNotice(cause: keyof typeof problemTitles): Notice {
  return {
    key: `service-picker:${cause}`,
    kind: 'warning',
    icon: 'warning',
    title: problemTitles[cause],
    time: noticeTime(),
  };
}

function sorted(entries: readonly ServiceEntry[]): readonly ServiceEntry[] {
  return [...entries].sort(
    (left, right) =>
      serviceDay(right.date).localeCompare(serviceDay(left.date)) ||
      names.compare(left.name, right.name) ||
      left.id.localeCompare(right.id),
  );
}

/** Loads the service menu on demand and opens services through main. */
export function useServicePicker(onProblem: (notice: Notice) => void) {
  const guard = useServiceSwitchGuard();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<readonly ServiceEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(false);
  const pending = useRef(false);
  const serviceChanges = useRef(0);
  useEffect(() => {
    alive.current = true;
    const stop = useShow.subscribe((next, previous) => {
      if (next.serviceId !== previous.serviceId) serviceChanges.current++;
    });
    return () => {
      alive.current = false;
      stop();
    };
  }, []);

  const report = (cause: keyof typeof problemTitles): void =>
    onProblem(problemNotice(cause));
  useEffect(() => {
    const api = window.llp;
    if (!open || api === undefined) return undefined;
    let active = true;
    let pushed = false;
    const stop = api.services.subscribeList(next => {
      if (!active) return;
      pushed = true;
      setEntries(sorted(next));
      setReady(true);
    });
    api.services.list().then(
      next => {
        if (active && !pushed) {
          setEntries(sorted(next));
          setReady(true);
        }
      },
      (cause: unknown) => {
        api.log.write({
          level: 'error',
          message: 'Could not load the service list',
          detail: cause instanceof Error ? cause.message : String(cause),
        });
        if (active && !pushed) {
          setReady(true);
          onProblem(problemNotice('load'));
        }
      },
    );
    return () => {
      active = false;
      stop();
    };
  }, [open, onProblem]);

  const close = (): void => {
    setOpen(false);
    setReady(false);
    setEntries([]);
    setQuery('');
  };
  const toggle = (): void => {
    if (pending.current || window.llp === undefined) return;
    if (open) {
      close();
      return;
    }
    setEntries([]);
    setQuery('');
    setOpen(true);
  };
  const choose = async (entry: ServiceEntry): Promise<void> => {
    const api = window.llp;
    if (pending.current || api === undefined) return;
    close();
    if (entry.id === useShow.getState().serviceId) return;
    pending.current = true;
    setBusy(true);
    const changes = serviceChanges.current;
    try {
      const answer = await api.service.open({serviceId: entry.id});
      if (!alive.current) return;
      if (!answer.ok) {
        report(answer.error.reason === 'failed' ? 'open' : answer.error.reason);
        return;
      }
      const next = answer.value;
      if (next.id !== entry.id) {
        report('open');
        return;
      }
      if (
        changes === serviceChanges.current ||
        useShow.getState().serviceId === next.id
      ) {
        applyService(next);
      }
    } catch (cause) {
      api.log.write({
        level: 'error',
        message: 'Could not open the service',
        detail: cause instanceof Error ? cause.message : String(cause),
      });
      if (alive.current) report('open');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const select = (entry: ServiceEntry): void => {
    if (entry.id === useShow.getState().serviceId) {
      close();
      return;
    }
    close();
    guard.request({kind: 'open', name: entry.name}, () => {
      choose(entry).catch((cause: unknown) => {
        console.error('Failed to report a service selection:', cause);
      });
    });
  };
  const visible = useMemo(() => {
    const text = query.normalize('NFC').trim().toLocaleLowerCase('ko');
    return entries.filter(entry =>
      entry.name.normalize('NFC').toLocaleLowerCase('ko').includes(text),
    );
  }, [entries, query]);
  return {
    open,
    ready,
    query,
    setQuery,
    entries,
    visible,
    busy,
    toggle,
    close,
    select,
    guardDialog: guard.dialog,
  };
}
