import type {MonitorIdentity} from '@core/schema/screens/monitorIdentity';

/**
 * A key for the monitor's manufacturer, product and serial number from its
 * EDID, or undefined when it has none.
 */
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

/**
 * Whether two identities are the same monitor: the same device path, ignoring
 * case, and the same serial key.
 */
export function sameMonitorIdentity(
  a: MonitorIdentity | undefined,
  b: MonitorIdentity | undefined,
): boolean {
  return (
    a?.devicePath.toUpperCase() === b?.devicePath.toUpperCase() &&
    monitorSerialKey(a) === monitorSerialKey(b)
  );
}
