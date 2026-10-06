import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/**
 * Reports which program owns the active (foreground) window, so the overlay can hide when
 * you alt-tab away from the game. One small PowerShell process asks Windows (user32
 * GetForegroundWindow) twice a second and prints the owning process name when it changes.
 * It only asks the OS which window is in front — it never looks inside the game.
 */
const SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
$last = -1
while ($true) {
  $p = 0
  [void][Fg]::GetWindowThreadProcessId([Fg]::GetForegroundWindow(), [ref]$p)
  if ($p -ne $last) {
    $last = $p
    $name = ''
    try { $name = (Get-Process -Id $p -ErrorAction Stop).ProcessName } catch {}
    [Console]::Out.WriteLine("fg:" + $name)
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds 500
}
`;

export class FocusWatcher {
  private child: ChildProcessWithoutNullStreams | null = null;
  private restarts = 0;
  private stopped = true;

  constructor(private onForeground: (processName: string | null) => void) {}

  start(): void {
    if (process.platform !== 'win32' || !this.stopped) return;
    this.stopped = false;
    this.spawn();
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill();
    this.child = null;
    this.onForeground(null);
  }

  private spawn(): void {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
    });
    this.child = child;
    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const l of lines) if (l.startsWith('fg:')) this.onForeground(l.slice(3).trim() || null);
    });
    child.on('error', () => this.onExit());
    child.on('exit', () => this.onExit());
  }

  private onExit(): void {
    this.child = null;
    if (this.stopped) return;
    // Unknown focus is treated as "show the overlay" — never hide it on a watcher failure.
    this.onForeground(null);
    if (this.restarts++ < 3) setTimeout(() => !this.stopped && this.spawn(), 5000 * this.restarts);
  }
}
