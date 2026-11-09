import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const read = (file: string): string =>
  readFileSync(resolve(root, file), 'utf8');

describe('assisted uninstaller data retention', () => {
  it('rejects the upstream deletion override before the uninstall section', () => {
    const upstream = read(
      'node_modules/app-builder-lib/templates/nsis/uninstaller.nsh',
    );
    const hook = read('build/installer.nsh');
    expect(
      upstream.indexOf('!insertmacro customUnInit'),
    ).toBeGreaterThanOrEqual(0);
    expect(upstream.indexOf('!insertmacro customUnInit')).toBeLessThan(
      upstream.indexOf('Section "un.'),
    );
    expect(upstream).toContain('${GetOptions} $R0 "--delete-app-data" $R1');
    expect(hook).toContain('!macro customUnInit');
    expect(hook).toMatch(
      /GetOptions[^\n]+--delete-app-data[^]*IfNot[^]*SetErrorLevel 2\s+Quit/u,
    );
    expect(read('electron-builder.yml')).toContain(
      'deleteAppDataOnUninstall: false',
    );
    expect(
      read('node_modules/app-builder-lib/templates/nsis/assistedInstaller.nsh'),
    ).not.toContain('delete-app-data');
  });
});
