/** Read-only Windows display topology and EDID query, executed in a hidden child. */
export const WINDOWS_MONITOR_QUERY = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class WindowsMonitorQuery {
  [StructLayout(LayoutKind.Sequential)] public struct Luid { public uint Low; public int High; }
  [StructLayout(LayoutKind.Sequential)] public struct Source { public Luid Adapter; public uint Id, Mode, Flags; }
  [StructLayout(LayoutKind.Sequential)] public struct Target {
    public Luid Adapter; public uint Id, Mode, Technology, Rotation, Scaling, Numerator, Denominator, Scanline;
    public int Available; public uint Flags;
  }
  [StructLayout(LayoutKind.Sequential)] public struct Path { public Source Source; public Target Target; public uint Flags; }
  [StructLayout(LayoutKind.Explicit, Size=64)] public struct Mode {
    [FieldOffset(0)] public uint Type;
    [FieldOffset(4)] public uint Id;
    [FieldOffset(8)] public Luid Adapter;
    [FieldOffset(16)] public uint Width;
    [FieldOffset(20)] public uint Height;
    [FieldOffset(28)] public int X;
    [FieldOffset(32)] public int Y;
  }
  [StructLayout(LayoutKind.Sequential)] public struct Header { public uint Type, Size; public Luid Adapter; public uint Id; }
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct TargetName {
    public Header Header; public uint Flags, Technology; public ushort Manufacturer, Product; public uint Connector;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=64)] public string Friendly;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DevicePath;
  }
  [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint flags, out uint paths, out uint modes);
  [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint flags, ref uint paths, [Out] Path[] pathArray, ref uint modes, [Out] Mode[] modeArray, IntPtr topology);
  [DllImport("user32.dll", EntryPoint="DisplayConfigGetDeviceInfo")] static extern int TargetInfo(ref TargetName name);
  public static object[] Read() {
    for (int attempt=0; attempt<3; attempt++) {
      uint pc, mc;
      int code=GetDisplayConfigBufferSizes(2, out pc, out mc);
      if(code!=0) throw new Exception("GetDisplayConfigBufferSizes="+code);
      if(pc>64 || mc>256) throw new Exception("Unexpected topology size");
      var paths=new Path[pc]; var modes=new Mode[mc];
      code=QueryDisplayConfig(2, ref pc, paths, ref mc, modes, IntPtr.Zero);
      if(code==122) continue;
      if(code!=0) throw new Exception("QueryDisplayConfig="+code);
      var result=new List<object>();
      for(int i=0;i<pc;i++) {
        var p=paths[i];
        if(p.Target.Available==0) continue;
        if(p.Source.Mode>=mc || modes[p.Source.Mode].Type!=1) throw new Exception("Missing source rectangle");
        var tn=new TargetName { Header=new Header { Type=2, Size=(uint)Marshal.SizeOf(typeof(TargetName)), Adapter=p.Target.Adapter, Id=p.Target.Id } };
        int tc=TargetInfo(ref tn);
        var m=modes[p.Source.Mode];
        result.Add(new { bounds=new { x=m.X, y=m.Y, width=m.Width, height=m.Height },
          devicePath=tc==0 ? tn.DevicePath : "" });
      }
      return result.ToArray();
    }
    throw new Exception("Topology changed on all three reads");
  }
}
'@

$paths = @([WindowsMonitorQuery]::Read())
$wmi = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorID -OperationTimeoutSec 5 | Where-Object Active | Select-Object -First 65 | ForEach-Object {
  [pscustomobject]@{
    instanceName=$_.InstanceName
    manufacturer=(-join [char[]]($_.ManufacturerName | Where-Object {$_ -ne 0})).Trim().ToUpperInvariant()
    product=(-join [char[]]($_.ProductCodeID | Where-Object {$_ -ne 0})).Trim().ToUpperInvariant()
    serial=(-join [char[]]($_.SerialNumberID | Where-Object {$_ -ne 0})).Trim().ToUpperInvariant()
  }
})
[pscustomobject]@{ paths=$paths; wmi=$wmi } | ConvertTo-Json -Depth 8 -Compress
`;
