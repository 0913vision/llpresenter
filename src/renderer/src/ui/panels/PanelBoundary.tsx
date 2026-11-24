import {
  Component,
  createContext,
  useContext,
  type ErrorInfo,
  type JSX,
  type ReactNode,
} from 'react';
import {Button} from '../buttons/Button';
import {EmptyState} from '../lists/EmptyState';

/** Where a panel that failed to draw reports it: the panel name and the error. */
export type PanelFailureReport = (panel: string, error: unknown) => void;

function reportToConsole(panel: string, error: unknown): void {
  console.error(`The ${panel} panel failed to draw:`, error);
}

/**
 * Where the panels of a window report a failure to draw; the app sends it to
 * the app log.
 */
export const PanelFailureContext =
  createContext<PanelFailureReport>(reportToConsole);

interface PanelBoundaryProps {
  /** The panel name, such as 예배 순서. */
  readonly label: string;
  readonly children: ReactNode;
}

interface FailureBoundaryProps extends PanelBoundaryProps {
  readonly report: PanelFailureReport;
}

interface PanelBoundaryState {
  readonly failed: boolean;
}

/**
 * Keeps an error that stops one panel from drawing inside that panel: it shows
 * "<panel> 표시 실패" with 다시 시도, and the rest of the window keeps working
 * (docs/TECH.md, error handling). Without it, React empties the whole window.
 */
export function PanelBoundary({
  label,
  children,
}: PanelBoundaryProps): JSX.Element {
  const report = useContext(PanelFailureContext);
  return (
    <FailureBoundary label={label} report={report}>
      {children}
    </FailureBoundary>
  );
}

/** React catches drawing errors only in a class component's error methods. */
class FailureBoundary extends Component<
  FailureBoundaryProps,
  PanelBoundaryState
> {
  override state: PanelBoundaryState = {failed: false};

  static getDerivedStateFromError(): PanelBoundaryState {
    return {failed: true};
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.report(
      this.props.label,
      error instanceof Error && info.componentStack
        ? Object.assign(error, {
            stack: `${error.stack ?? error.message}\n${info.componentStack}`,
          })
        : error,
    );
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <PanelFailure label={this.props.label} retry={this.retry} />;
  }

  private readonly retry = (): void => {
    this.setState({failed: false});
  };
}

function PanelFailure({
  label,
  retry,
}: {
  readonly label: string;
  readonly retry: () => void;
}): JSX.Element {
  return (
    <EmptyState
      text={`${label} 표시 실패`}
      action={<Button onClick={retry}>다시 시도</Button>}
    />
  );
}
