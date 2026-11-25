import {THEME_CANVAS} from '@core/schema/screens/screens';
import {POWERPOINT_IMPORT_LIMITS} from '@core/schema/songs/textImportLimits';
import {
  endLeftPowerPoint,
  windowsPowerPointProcesses,
  type PowerPointProcesses,
  type StartedPowerPointStore,
} from './powerpointProcess';
import {PowerPointRun, type PowerPointImagesResult} from './powerpointRun';

// NOTE(0913vision): Slides export at the canvas size; the script names it
// through W and H.
const {width: W, height: H} = THEME_CANVAS;

/**
 * The PowerShell script that exports the visible slides as pictures. It is a
 * literal so paths are passed in the environment, never interpolated.
 */
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
    # No PowerPoint ran before, so the one that runs now is this script's own.
    foreach ($process in @(Get-Process POWERPNT -ErrorAction SilentlyContinue)) {
      [Console]::Out.WriteLine(('STARTED {0}' -f $process.Id))
    }
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
  $scale = [Math]::Min(${W}.0 / $slideWidth, ${H}.0 / $slideHeight)
  $exportWidth = [Math]::Max(1, [Math]::Min(${W}, [int][Math]::Round($slideWidth * $scale)))
  $exportHeight = [Math]::Max(1, [Math]::Min(${H}, [int][Math]::Round($slideHeight * $scale)))
  $padded = $exportWidth -ne ${W} -or $exportHeight -ne ${H}
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
          $surface = New-Object System.Drawing.Bitmap(${W}, ${H})
          $graphics = [System.Drawing.Graphics]::FromImage($surface)
          $graphics.Clear([System.Drawing.Color]::Black)
          $graphics.DrawImageUnscaled($image, [int]((${W} - $exportWidth) / 2), [int]((${H} - $exportHeight) / 2))
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

/**
 * Runs only after a run that used the operator's PowerPoint was ended: closes
 * the run's presentation and puts the settings back; marker files limit it
 * to that run.
 */
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
  } finally {}
}
`;

const MAX_DECORATION_BATCH = 200;

/** A store that keeps the started PowerPoint only while the app runs. */
function memoryStartedPowerPoint(): StartedPowerPointStore {
  let pid: number | null = null;
  return {
    read: () => pid,
    write: next => {
      pid = next;
    },
  };
}

/** What a job looks at processes with, and where it keeps the one it started. */
export interface PowerPointImagesJobOptions {
  readonly processes?: PowerPointProcesses;
  readonly started?: StartedPowerPointStore;
}

/**
 * Runs PowerPoint invisibly, one run at a time, and reports completed visible
 * slides. Each run owns what it makes and frees it on every path; a
 * PowerPoint an earlier run left behind is ended before the next one.
 */
export class PowerPointImagesJob {
  private current: PowerPointRun | null = null;
  private busy = false;
  private cancelled = false;
  private readonly processes: PowerPointProcesses;
  private readonly started: StartedPowerPointStore;

  constructor({
    processes = windowsPowerPointProcesses,
    started = memoryStartedPowerPoint(),
  }: PowerPointImagesJobOptions = {}) {
    this.processes = processes;
    this.started = started;
  }

  cancel(): void {
    this.cancelled = true;
    this.current?.cancel();
  }

  /** Whether the run was cancelled; that can happen while it waits. */
  private wasCancelled(): boolean {
    return this.cancelled;
  }

  async run(
    path: string,
    directory: string,
    progress: ((done: number, total: number, number: number) => void) & {
      readonly decorationSlides?: readonly number[];
      readonly convert?: true;
    },
  ): Promise<PowerPointImagesResult> {
    const {decorationSlides, convert} = progress;
    if (convert && decorationSlides !== undefined) return 'file';
    if (!decorationBatchValid(decorationSlides)) return 'file';
    if (this.busy) return 'unresponsive';
    this.busy = true;
    this.cancelled = false;
    try {
      await endLeftPowerPoint(this.started, this.processes);
      if (this.wasCancelled()) return 'cancelled';
      await using run = new PowerPointRun({
        script: POWERPOINT_IMAGE_SCRIPT,
        cleanupScript: POWERPOINT_IMAGE_CLEANUP_SCRIPT,
        directory,
        env: {
          LLP_PPT_SOURCE: path,
          LLP_PPT_DIRECTORY: directory,
          LLP_PPT_DECORATION_SLIDE: (decorationSlides ?? []).join(','),
          LLP_PPT_CONVERT: convert ? '1' : '',
        },
        progress,
        processes: this.processes,
        started: this.started,
      });
      this.current = run;
      return await run.result;
    } finally {
      this.current = null;
      this.busy = false;
    }
  }
}

/**
 * Whether the slides asked for as decorations make a batch the script takes:
 * none asked, or up to the batch size of distinct slide numbers in range.
 */
function decorationBatchValid(numbers: readonly number[] | undefined): boolean {
  if (numbers === undefined) return true;
  return (
    numbers.length > 0 &&
    numbers.length <= MAX_DECORATION_BATCH &&
    new Set(numbers).size === numbers.length &&
    numbers.every(
      number =>
        Number.isSafeInteger(number) &&
        number >= 1 &&
        number <= POWERPOINT_IMPORT_LIMITS.slides,
    )
  );
}
