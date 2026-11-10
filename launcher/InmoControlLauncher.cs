using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace InmoControlDesktop
{
    internal static class Program
    {
        private static string _exeDir;
        private static string _portableDataDir;
        private static string _portableDbPath;
        private static string _portableBackupDir;
        private static string _localAppDataDir;
        private static string _localAppDbPath;
        private static string _localAppBackupDir;
        private static readonly object DbLock = new object();
        private static volatile bool _running = true;
        private static TcpListener _listener;

        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            _exeDir = AppDomain.CurrentDomain.BaseDirectory;
            _portableDataDir = Path.Combine(_exeDir, "InmoControl_Data", "data");
            _portableBackupDir = Path.Combine(_exeDir, "InmoControl_Data", "backups");
            _portableDbPath = Path.Combine(_portableDataDir, "inmo_database.db");

            string localAppRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "InmoControl"
            );
            _localAppDataDir = Path.Combine(localAppRoot, "data");
            _localAppBackupDir = Path.Combine(localAppRoot, "backups");
            _localAppDbPath = Path.Combine(_localAppDataDir, "inmo_database.db");

            EnsureDirectories();
            SynchronizeInitialDatabaseFiles();

            int port = GetAvailablePort();
            _listener = new TcpListener(IPAddress.Loopback, port);
            _listener.Start();

            Thread serverThread = new Thread(RunHttpLoop)
            {
                IsBackground = true,
                Name = "InmoControlLocalServer"
            };
            serverThread.Start();

            string appUrl = "http://127.0.0.1:" + port + "/";
            Process browserProcess = LaunchDesktopShell(appUrl);

            if (browserProcess != null)
            {
                Thread monitorThread = new Thread(() =>
                {
                    try
                    {
                        browserProcess.WaitForExit();
                    }
                    catch
                    {
                        // Ignore process wait exceptions
                    }
                    PerformShutdownBackup();
                    _running = false;
                    try
                    {
                        _listener.Stop();
                    }
                    catch
                    {
                        // Ignore listener stop errors
                    }
                    Application.Exit();
                })
                {
                    IsBackground = true
                };
                monitorThread.Start();
                Application.Run();
            }
            else
            {
                // Fallback if browser shell returns immediately
                using (NotifyIcon tray = new NotifyIcon())
                {
                    tray.Icon = System.Drawing.SystemIcons.Application;
                    tray.Text = "InmoControl 2.0 - Base de Datos Local Activa";
                    tray.Visible = true;

                    ContextMenu menu = new ContextMenu();
                    menu.MenuItems.Add("Abrir InmoControl 2.0", (s, e) => Process.Start(appUrl));
                    menu.MenuItems.Add("Abrir Carpeta de Base de Datos Local", (s, e) => Process.Start("explorer.exe", _portableDataDir));
                    menu.MenuItems.Add("-");
                    menu.MenuItems.Add("Cerrar y Respaldar", (s, e) =>
                    {
                        PerformShutdownBackup();
                        tray.Visible = false;
                        _running = false;
                        Application.Exit();
                    });
                    tray.ContextMenu = menu;

                    Application.Run();
                }
            }
        }

        private static void EnsureDirectories()
        {
            try { Directory.CreateDirectory(_portableDataDir); } catch { }
            try { Directory.CreateDirectory(_portableBackupDir); } catch { }
            try { Directory.CreateDirectory(_localAppDataDir); } catch { }
            try { Directory.CreateDirectory(_localAppBackupDir); } catch { }
        }

        private static void SynchronizeInitialDatabaseFiles()
        {
            lock (DbLock)
            {
                try
                {
                    bool portableExists = File.Exists(_portableDbPath);
                    bool localAppExists = File.Exists(_localAppDbPath);

                    if (portableExists && !localAppExists)
                    {
                        File.Copy(_portableDbPath, _localAppDbPath, true);
                    }
                    else if (!portableExists && localAppExists)
                    {
                        File.Copy(_localAppDbPath, _portableDbPath, true);
                    }
                    else if (portableExists && localAppExists)
                    {
                        DateTime portableTime = File.GetLastWriteTimeUtc(_portableDbPath);
                        DateTime localTime = File.GetLastWriteTimeUtc(_localAppDbPath);
                        if (portableTime >= localTime)
                        {
                            File.Copy(_portableDbPath, _localAppDbPath, true);
                        }
                        else
                        {
                            File.Copy(_localAppDbPath, _portableDbPath, true);
                        }
                    }
                }
                catch
                {
                    // Ignore initial sync errors
                }
            }
        }

        private static string ReadLocalDatabaseJson()
        {
            lock (DbLock)
            {
                try
                {
                    if (File.Exists(_portableDbPath))
                    {
                        string content = File.ReadAllText(_portableDbPath, Encoding.UTF8).Trim();
                        if (content.StartsWith("{") && content.EndsWith("}"))
                        {
                            return content;
                        }
                    }
                    if (File.Exists(_localAppDbPath))
                    {
                        string content = File.ReadAllText(_localAppDbPath, Encoding.UTF8).Trim();
                        if (content.StartsWith("{") && content.EndsWith("}"))
                        {
                            return content;
                        }
                    }
                }
                catch
                {
                    // Ignore read errors
                }
                return "null";
            }
        }

        private static void SaveLocalDatabaseJson(string jsonPayload)
        {
            if (string.IsNullOrWhiteSpace(jsonPayload)) return;
            string trimmed = jsonPayload.Trim();
            if (!trimmed.StartsWith("{") || !trimmed.EndsWith("}")) return;

            lock (DbLock)
            {
                WriteFileAtomically(_portableDbPath, trimmed);
                WriteFileAtomically(_localAppDbPath, trimmed);

                string dateStamp = DateTime.Now.ToString("yyyyMMdd");
                string portableDailyBackup = Path.Combine(_portableBackupDir, "inmo_backup_" + dateStamp + ".db");
                string localDailyBackup = Path.Combine(_localAppBackupDir, "inmo_backup_" + dateStamp + ".db");
                WriteFileAtomically(portableDailyBackup, trimmed);
                WriteFileAtomically(localDailyBackup, trimmed);
            }
        }

        private static void PerformShutdownBackup()
        {
            lock (DbLock)
            {
                try
                {
                    string currentJson = ReadLocalDatabaseJson();
                    if (currentJson != "null")
                    {
                        string stamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                        string portableSnap = Path.Combine(_portableBackupDir, "inmo_backup_" + stamp + ".db");
                        string localSnap = Path.Combine(_localAppBackupDir, "inmo_backup_" + stamp + ".db");
                        WriteFileAtomically(portableSnap, currentJson);
                        WriteFileAtomically(localSnap, currentJson);
                    }
                }
                catch
                {
                    // Ignore shutdown backup errors
                }
            }
        }

        private static void WriteFileAtomically(string targetPath, string content)
        {
            try
            {
                string dir = Path.GetDirectoryName(targetPath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
                string tempPath = targetPath + ".wal.tmp";
                File.WriteAllText(tempPath, content, new UTF8Encoding(false));
                if (File.Exists(targetPath))
                {
                    File.Delete(targetPath);
                }
                File.Move(tempPath, targetPath);
            }
            catch
            {
                try
                {
                    File.WriteAllText(targetPath, content, new UTF8Encoding(false));
                }
                catch
                {
                    // Ignore write fallback error
                }
            }
        }

        private static int GetAvailablePort()
        {
            TcpListener temp = new TcpListener(IPAddress.Loopback, 0);
            temp.Start();
            int port = ((IPEndPoint)temp.LocalEndpoint).Port;
            temp.Stop();
            return port;
        }

        private static Process LaunchDesktopShell(string url)
        {
            string profileDir = Path.Combine(_exeDir, "InmoControl_Data", "runtime_profile");
            try { Directory.CreateDirectory(profileDir); } catch { }

            string[] candidateBrowsers = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string browserPath in candidateBrowsers)
            {
                if (File.Exists(browserPath))
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo
                        {
                            FileName = browserPath,
                            Arguments = "--app=\"" + url + "\" --window-size=1440,900 --user-data-dir=\"" + profileDir + "\" --no-first-run --no-default-browser-check",
                            UseShellExecute = false
                        };
                        return Process.Start(psi);
                    }
                    catch
                    {
                        // Try next candidate
                    }
                }
            }

            try
            {
                Process.Start(url);
            }
            catch
            {
                // Ignore browser launch error
            }
            return null;
        }

        private static void RunHttpLoop()
        {
            while (_running)
            {
                try
                {
                    TcpClient client = _listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (!_running) break;
                }
            }
        }

        private static void HandleClient(object state)
        {
            using (TcpClient client = (TcpClient)state)
            using (NetworkStream stream = client.GetStream())
            {
                try
                {
                    stream.ReadTimeout = 10000;
                    stream.WriteTimeout = 10000;

                    string requestLine = ReadLine(stream);
                    if (string.IsNullOrEmpty(requestLine)) return;

                    string[] parts = requestLine.Split(' ');
                    if (parts.Length < 2) return;

                    string method = parts[0].ToUpperInvariant();
                    string rawPath = parts[1];
                    int qIdx = rawPath.IndexOf('?');
                    string path = qIdx >= 0 ? rawPath.Substring(0, qIdx) : rawPath;

                    int contentLength = 0;
                    string headerLine;
                    while (!string.IsNullOrEmpty(headerLine = ReadLine(stream)))
                    {
                        if (headerLine.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                        {
                            string val = headerLine.Substring("Content-Length:".Length).Trim();
                            int.TryParse(val, out contentLength);
                        }
                    }

                    if (method == "POST" && path == "/api/local-db")
                    {
                        string body = ReadExactBytesAsUtf8(stream, contentLength);
                        SaveLocalDatabaseJson(body);
                        byte[] okBytes = Encoding.UTF8.GetBytes("{\"ok\":true}");
                        WriteResponse(stream, "200 OK", "application/json; charset=utf-8", okBytes);
                        return;
                    }

                    if (method == "GET" && path == "/api/init-db.js")
                    {
                        string dbJson = ReadLocalDatabaseJson();
                        string js = "window.__INMOCONTROL_DESKTOP_EXE__ = true;\nwindow.__INMOCONTROL_INITIAL_DB__ = " + dbJson + ";\n";
                        byte[] jsBytes = Encoding.UTF8.GetBytes(js);
                        WriteResponse(stream, "200 OK", "application/javascript; charset=utf-8", jsBytes);
                        return;
                    }

                    if (method == "GET" && path == "/assets/app.css")
                    {
                        byte[] cssBytes = ReadEmbeddedResource("app.css");
                        WriteResponse(stream, "200 OK", "text/css; charset=utf-8", cssBytes);
                        return;
                    }

                    if (method == "GET" && path == "/assets/app.js")
                    {
                        byte[] jsBytes = ReadEmbeddedResource("app.js");
                        WriteResponse(stream, "200 OK", "application/javascript; charset=utf-8", jsBytes);
                        return;
                    }

                    // Default SPA fallback: serve index.html
                    byte[] htmlBytes = ReadEmbeddedResource("index.html");
                    WriteResponse(stream, "200 OK", "text/html; charset=utf-8", htmlBytes);
                }
                catch
                {
                    // Ignore individual client disconnects
                }
            }
        }

        private static string ReadLine(NetworkStream stream)
        {
            MemoryStream ms = new MemoryStream();
            int b;
            while ((b = stream.ReadByte()) != -1)
            {
                if (b == '\n') break;
                if (b != '\r') ms.WriteByte((byte)b);
            }
            if (ms.Length == 0 && b == -1) return null;
            return Encoding.ASCII.GetString(ms.ToArray());
        }

        private static string ReadExactBytesAsUtf8(NetworkStream stream, int count)
        {
            if (count <= 0) return string.Empty;
            byte[] buffer = new byte[count];
            int offset = 0;
            while (offset < count)
            {
                int read = stream.Read(buffer, offset, count - offset);
                if (read <= 0) break;
                offset += read;
            }
            return Encoding.UTF8.GetString(buffer, 0, offset);
        }

        private static byte[] ReadEmbeddedResource(string resourceName)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream s = asm.GetManifestResourceStream(resourceName))
            {
                if (s == null) return Encoding.UTF8.GetBytes("/* Resource not found: " + resourceName + " */");
                using (MemoryStream ms = new MemoryStream())
                {
                    s.CopyTo(ms);
                    return ms.ToArray();
                }
            }
        }

        private static void WriteResponse(NetworkStream stream, string status, string contentType, byte[] body)
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(status).Append("\r\n");
            sb.Append("Content-Type: ").Append(contentType).Append("\r\n");
            sb.Append("Content-Length: ").Append(body.Length).Append("\r\n");
            sb.Append("Cache-Control: no-store, no-cache, must-revalidate\r\n");
            sb.Append("Connection: close\r\n\r\n");
            byte[] headerBytes = Encoding.ASCII.GetBytes(sb.ToString());
            stream.Write(headerBytes, 0, headerBytes.Length);
            if (body.Length > 0)
            {
                stream.Write(body, 0, body.Length);
            }
            stream.Flush();
        }
    }
}
