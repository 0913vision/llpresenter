import type {MonitorIdentity} from '../schema/monitorIdentity';

export function monitorSerialKey(
  identity: MonitorIdentity | undefined,
): string | undefined {
  const edid = identity?.edid;
  return edid === undefined
    ? undefined
    : JSON.stringify([
        edid.manufacturer,
        edid.product,
        edid.serial.trim().toUpperCase(),
      ]);
}

export function sameMonitorIdentity(
  a: MonitorIdentity | undefined,
  b: MonitorIdentity | undefined,
): boolean {
  return (
    a?.devicePath.toUpperCase() === b?.devicePath.toUpperCase() &&
    monitorSerialKey(a) === monitorSerialKey(b)
  );
}
