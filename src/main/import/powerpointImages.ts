import {spawn, type ChildProcess} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {POWERPOINT_IMPORT_LIMITS} from '@core/songs/textImportLimits';

/** Kept as a literal so paths are passed in the environment, never interpolated. */
export const POWERPOINT_IMAGE_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$powerpoint = $null
$presentation = $null
$created = $false
$settingsCaptured = $false
function Remove-SlideText($shapes) {
  for ($i = $shapes.Count; $i -gt 0; $i--) {
    $shape = $shapes.Item($i)
    if ($shape.Type -eq 6) {
      Remove-SlideText $shape.GroupItems
    } elseif ($shape.Type -eq 14 -or ($shape.HasTextFrame -eq -1 -and $shape.TextFrame.HasText -eq -1)) {
      $shape.Delete()
    }
  }
}
try {
  try { $powerpoint = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
  catch {
    if (Get-Process POWERPNT -ErrorAction SilentlyContinue) {
      [Console]::Out.WriteLine('FAILURE unresponsive')
      throw 'Running PowerPoint is unavailable for automation'
    }
    if ($null -eq [Type]::GetTypeFromProgID('PowerPoint.Application')) {
      [Console]::Out.WriteLine('FAILURE unavailable')
      throw 'PowerPoint is not installed'
    }
    try { $powerpoint = New-Object -ComObject PowerPoint.Application }
    catch { [Console]::Out.WriteLine('FAILURE unresponsive'); throw }
    $created = $true
    [IO.File]::WriteAllText((Join-Path $env:LLP_PPT_DIRECTORY 'created'), '1')
  }
  $security = $powerpoint.AutomationSecurity
  $alerts = $powerpoint.DisplayAlerts
  $settingsCaptured = $true
  [IO.File]::WriteAllText((Join-Path $env:LLP_PPT_DIRECTORY 'settings'), (('{0},{1}' -f [int]$security, [int]$alerts)))
  $powerpoint.AutomationSecurity = 3
  $powerpoint.DisplayAlerts = 1
  foreach ($open in $powerpoint.Presentations) {
    if ([String]::Equals($open.FullName, $env:LLP_PPT_SOURCE, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Presentation is already open'
    }
  }
  [IO.File]::WriteAllText((Join-Path $env:LLP_PPT_DIRECTORY 'opening'), '1')
  $decorations = $env:LLP_PPT_DECORATION_SLIDE
  $readOnly = if ($decorations) { 0 } else { -1 }
  $presentation = $powerpoint.Presentations.Open($env:LLP_PPT_SOURCE, $readOnly, 0, 0)
  if (Test-Path (Join-Path $env:LLP_PPT_DIRECTORY 'cancel')) { throw 'Cancelled' }
  if ($env:LLP_PPT_CONVERT -eq '1') {
    $presentation.SaveAs((Join-Path $env:LLP_PPT_DIRECTORY 'presentation.pptx'), 24)
  } else {
  $slideWidth = [double]$presentation.PageSetup.SlideWidth
  $slideHeight = [double]$presentation.PageSetup.SlideHeight
  if ($slideWidth -le 0 -or $slideHeight -le 0) { throw 'Invalid slide size' }
  $scale = [Math]::Min(1920.0 / $slideWidth, 1080.0 / $slideHeight)
  $exportWidth = [Math]::Max(1, [Math]::Min(1920, [int][Math]::Round($slideWidth * $scale)))
  $exportHeight = [Math]::Max(1, [Math]::Min(1080, [int][Math]::Round($slideHeight * $scale)))
  $padded = $exportWidth -ne 1920 -or $exportHeight -ne 1080
  if ($padded) { Add-Type -AssemblyName System.Drawing }
  if ($decorations) {
    $visible = @($decorations.Split(',') | ForEach-Object { $presentation.Slides.Item([int]$_) })
  } else {
    $visible = @($presentation.Slides | Where-Object { $_.SlideShowTransition.Hidden -ne -1 })
  }
  if ($visible.Count -eq 0 -or $visible.Count -gt 200) { throw 'Unsupported slide count' }
  $index = 0
  foreach ($slide in $visible) {
    if (Test-Path (Join-Path $env:LLP_PPT_DIRECTORY 'cancel')) { throw 'Cancelled' }
    $index++
    $path = Join-Path $env:LLP_PPT_DIRECTORY (('llp-ppt-{0:D4}.png' -f $index))
    try {
      if ($decorations) { Remove-SlideText $slide.Shapes }
      $slide.Export($path, 'PNG', $exportWidth, $exportHeight)
      if ($padded) {
        $image = $null
        $surface = $null
        $graphics = $null
        try {
          $image = [System.Drawing.Image]::FromFile($path)
          $surface = New-Object System.Drawing.Bitmap(1920, 1080)
          $graphics = [System.Drawing.Graphics]::FromImage($surface)
          $graphics.Clear([System.Drawing.Color]::Black)
          $graphics.DrawImageUnscaled($image, [int]((1920 - $exportWidth) / 2), [int]((1080 - $exportHeight) / 2))
          $surface.Save(($path + '.padded'), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
          if ($null -ne $graphics) { $graphics.Dispose() }
          if ($null -ne $surface) { $surface.Dispose() }
          if ($null -ne $image) { $image.Dispose() }
        }
        [IO.File]::Delete($path)
        [IO.File]::Move(($path + '.padded'), $path)
      }
    } catch {
      if (-not $decorations) { throw }
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path (Join-Path $env:LLP_PPT_DIRECTORY 'cancel')) { throw 'Cancelled' }
    [Console]::Out.WriteLine(('PROGRESS {0} {1} {2}' -f $index, $visible.Count, $slide.SlideIndex))
  }
  }
} finally {
  try {
    if ($null -ne $presentation) { $presentation.Close() }
  } finally {
    if ($null -ne $powerpoint) {
      try {
        if ($settingsCaptured) {
          try { $powerpoint.AutomationSecurity = $security }
          finally { $powerpoint.DisplayAlerts = $alerts }
        }
      } finally {
        if ($created) { $powerpoint.Quit() }
      }
    }
  }
}
`;

/** Runs only after a forced kill; marker files limit cleanup to this job. */
export const POWERPOINT_IMAGE_CLEANUP_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try { $powerpoint = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application') }
catch { exit 0 }
try {
  if (Test-Path (Join-Path $env:LLP_PPT_DIRECTORY 'opening')) {
    foreach ($presentation in @($powerpoint.Presentations)) {
      if ([String]::Equals($presentation.FullName, $env:LLP_PPT_SOURCE, [StringComparison]::OrdinalIgnoreCase)) {
        $presentation.Close()
        break
      }
    }
  }
} finally {
  try {
    $settings = Join-Path $env:LLP_PPT_DIRECTORY 'settings'
    if (Test-Path $settings) {
      $values = [IO.File]::ReadAllText($settings).Split(',')
      try { $powerpoint.AutomationSecurity = [int]$values[0] }
      finally { $powerpoint.DisplayAlerts = [int]$values[1] }
    }
  } finally {
    if ((Test-Path (Join-Path $env:LLP_PPT_DIRECTORY 'created')) -and $powerpoint.Presentations.Count -eq 0) { $powerpoint.Quit() }
  }
}
`;

const TIMEOUT_MS = 120_000;
const MAX_DECORATION_BATCH = 200;

export type PowerPointImagesResult =
  'ok' | 'cancelled' | 'unavailable' | 'unresponsive' | 'file';

/** Runs PowerPoint invisibly and reports completed visible slides. */
export class PowerPointImagesJob {
  private child: ChildProcess | null = null;
  private cancelled = false;
  private directory: string | null = null;
  private cancelTimer: ReturnType<typeof setTimeout> | null = null;
  private forceStop: (() => void) | null = null;

  cancel(): void {
    this.cancelled = true;
    if (this.directory !== null) {
      try {
        writeFileSync(join(this.directory, 'cancel'), '');
        this.cancelTimer ??= setTimeout(() => this.forceStop?.(), 5000);
      } catch {
        this.forceStop?.();
      }
    }
  }

  run(
    path: string,
    directory: string,
    progress: ((done: number, total: number, number: number) => void) & {
      readonly decorationSlide?: number;
      readonly decorationSlides?: readonly number[];
      readonly convert?: true;
    },
  ): Promise<PowerPointImagesResult> {
    const {decorationSlide, decorationSlides, convert} = progress;
    if (
      convert &&
      (decorationSlide !== undefined || decorationSlides !== undefined)
    ) {
      return Promise.resolve('file');
    }
    if (decorationSlide !== undefined && decorationSlides !== undefined) {
      return Promise.resolve('file');
    }
    const numbers =
      decorationSlides ??
      (decorationSlide === undefined ? [] : [decorationSlide]);
    if (
      (decorationSlides !== undefined && numbers.length === 0) ||
      numbers.length > MAX_DECORATION_BATCH ||
      new Set(numbers).size !== numbers.length ||
      numbers.some(
        number =>
          !Number.isSafeInteger(number) ||
          number < 1 ||
          number > POWERPOINT_IMPORT_LIMITS.slides,
      )
    ) {
      return Promise.resolve('file');
    }
    if (this.child) return Promise.resolve('unresponsive');
    this.cancelled = false;
    this.directory = directory;
    return new Promise(resolve => {
      const encoded = Buffer.from(POWERPOINT_IMAGE_SCRIPT, 'utf16le').toString(
        'base64',
      );
      const child = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-EncodedCommand',
          encoded,
        ],
        {
          windowsHide: true,
          env: {
            ...process.env,
            LLP_PPT_SOURCE: path,
            LLP_PPT_DIRECTORY: directory,
            LLP_PPT_DECORATION_SLIDE: numbers.join(','),
            LLP_PPT_CONVERT: convert ? '1' : '',
          },
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      );
      this.child = child;
      let output = '';
      let settled = false;
      let forced = false;
      let timedOut = false;
      let failure: PowerPointImagesResult = 'file';
      let cleanupStarted = false;
      let killWait: ReturnType<typeof setTimeout> | null = null;
      const cleanup = (): void => {
        if (cleanupStarted || settled) return;
        cleanupStarted = true;
        if (killWait !== null) clearTimeout(killWait);
        const code = Buffer.from(
          POWERPOINT_IMAGE_CLEANUP_SCRIPT,
          'utf16le',
        ).toString('base64');
        const helper = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-EncodedCommand',
            code,
          ],
          {
            windowsHide: true,
            env: {
              ...process.env,
              LLP_PPT_SOURCE: path,
              LLP_PPT_DIRECTORY: directory,
            },
            stdio: ['ignore', 'ignore', 'ignore'],
          },
        );
        const limit = setTimeout(() => {
          helper.kill();
          finish('unresponsive');
        }, 5000);
        const complete = (): void => {
          clearTimeout(limit);
          finish('unresponsive');
        };
        helper.once('error', complete);
        helper.once('close', complete);
      };
      this.forceStop = () => {
        if (forced || settled) return;
        forced = true;
        child.kill();
        killWait = setTimeout(cleanup, 1000);
      };
      const cleanupTimer = setTimeout(() => {
        timedOut = true;
        this.cancel();
      }, TIMEOUT_MS - 5000);
      const timer = setTimeout(() => {
        this.forceStop?.();
      }, TIMEOUT_MS);
      const finish = (result: PowerPointImagesResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(cleanupTimer);
        clearTimeout(timer);
        if (killWait !== null) clearTimeout(killWait);
        if (this.cancelTimer !== null) clearTimeout(this.cancelTimer);
        this.cancelTimer = null;
        this.forceStop = null;
        if (this.child === child) this.child = null;
        this.directory = null;
        resolve(
          timedOut ? 'unresponsive' : this.cancelled ? 'cancelled' : result,
        );
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        output += chunk;
        const lines = output.split(/\r?\n/);
        output = lines.pop() ?? '';
        for (const line of lines) {
          if (line === 'FAILURE unavailable') failure = 'unavailable';
          else if (line === 'FAILURE unresponsive') failure = 'unresponsive';
          const match = /^PROGRESS (\d+) (\d+) (\d+)$/.exec(line);
          if (match) {
            progress(Number(match[1]), Number(match[2]), Number(match[3]));
          }
        }
      });
      child.once('error', () => {
        if (!forced) finish('unresponsive');
      });
      child.once('close', code => {
        if (forced) cleanup();
        else finish(code === 0 ? 'ok' : failure);
      });
    });
  }
}
