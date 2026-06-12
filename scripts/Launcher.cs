using System;
using System.Diagnostics;
using System.IO;

internal static class Launcher
{
    [STAThread]
    private static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(root, "scripts", "launch-site.ps1");
        if (!File.Exists(script))
        {
            System.Windows.Forms.MessageBox.Show("Launcher script not found: " + script, "NJU Campus Map");
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true
        });
    }
}
