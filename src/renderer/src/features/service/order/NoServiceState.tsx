import type {JSX} from 'react';
import {Button} from '@renderer/ui/Button';
import {EmptyState} from '@renderer/ui/EmptyState';

/** The 예배 순서 with no service open: 예배 없음 and 새 예배… to make one. */
export function NoServiceState({
  onNewService,
}: {
  readonly onNewService: () => void;
}): JSX.Element {
  return (
    <EmptyState
      text="예배 없음"
      action={
        <Button
          icon="plus"
          disabled={window.llp === undefined}
          onClick={onNewService}
        >
          새 예배…
        </Button>
      }
    />
  );
}
