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
        private const int PreferredPort = 14280;
        private static string _exeDir;
        private static string _portableDataDir;
        private static string _portableDbPath;
        private static string _portableBackupDir;
        private static string _localAppDataDir;
        private static string _localAppDbPath;
        private static string _localAppBackupDir;
        private static readonly object DbLock = new object();
        private static volatile bool _running = true;
        private static volatile bool _clientEverConnected = false;
        private static DateTime _serverStartUtc = DateTime.UtcNow;
        private static DateTime _lastActivityUtc = DateTime.UtcNow;
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

            // Terminate any previous running InmoControl launcher process so the latest executable always takes over
            TerminatePreviousInstances();

            int port = BindListenerPort();
            _serverStartUtc = DateTime.UtcNow;
            _lastActivityUtc = DateTime.UtcNow;

            Thread serverThread = new Thread(RunHttpLoop)
            {
                IsBackground = true,
                Name = "InmoControlLocalServer"
            };
            serverThread.Start();

            string appUrl = "http://127.0.0.1:" + port + "/";

            // Wait briefly until listener is ready before launching the shell window
            WaitForServerReady(port);
            LaunchDesktopShell(appUrl);

            using (NotifyIcon tray = new NotifyIcon())
            {
                tray.Icon = System.Drawing.SystemIcons.Application;
                tray.Text = "InmoControl 2.0 (127.0.0.1:" + port + ")";
                tray.Visible = true;
                tray.DoubleClick += (s, e) => LaunchDesktopShell(appUrl);

                ContextMenu menu = new ContextMenu();
                menu.MenuItems.Add("Abrir Ventana de InmoControl 2.0", (s, e) => LaunchDesktopShell(appUrl));
                menu.MenuItems.Add("Abrir Carpeta de Base de Datos Local", (s, e) =>
                {
                    try { Process.Start("explorer.exe", _portableDataDir); } catch { }
                });
                menu.MenuItems.Add("-");
                menu.MenuItems.Add("Guardar Respaldo y Cerrar", (s, e) =>
                {
                    PerformShutdownBackup();
                    tray.Visible = false;
                    _running = false;
                    try { _listener.Stop(); } catch { }
                    Application.Exit();
                });
                tray.ContextMenu = menu;

                // Watchdog thread: once the user closes the window and heartbeats stop for 20s, back up and exit cleanly
                Thread watchdog = new Thread(() =>
                {
                    while (_running)
                    {
                        Thread.Sleep(3000);
                        double secondsSinceStart = (DateTime.UtcNow - _serverStartUtc).TotalSeconds;
                        double secondsSinceActivity = (DateTime.UtcNow - _lastActivityUtc).TotalSeconds;

                        if (_clientEverConnected && secondsSinceStart > 25 && secondsSinceActivity > 20)
                        {
                            PerformShutdownBackup();
                            tray.Visible = false;
                            _running = false;
                            try { _listener.Stop(); } catch { }
                            Application.Exit();
                            break;
                        }
                    }
                })
                {
                    IsBackground = true,
                    Name = "InmoControlWatchdog"
                };
                watchdog.Start();

                Application.Run();
            }
        }

        private static void TerminatePreviousInstances()
        {
            try
            {
                int currentPid = Process.GetCurrentProcess().Id;
                foreach (Process proc in Process.GetProcesses())
                {
                    try
                    {
                        if (proc.Id != currentPid &&
                            proc.ProcessName.IndexOf("InmoControl", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            proc.Kill();
                            proc.WaitForExit(1500);
                        }
                    }
                    catch
                    {
                        // Ignore inaccessible processes
                    }
                }
            }
            catch
            {
                // Ignore enumeration errors
            }
        }

        private static bool IsExistingInstanceRunning(int port)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/health");
                req.Timeout = 600;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static int BindListenerPort()
        {
            for (int candidate = PreferredPort; candidate < PreferredPort + 20; candidate++)
            {
                try
                {
                    TcpListener listener = new TcpListener(IPAddress.Loopback, candidate);
                    listener.Start();
                    _listener = listener;
                    return candidate;
                }
                catch
                {
                    // Port busy, try next
                }
            }

            TcpListener fallback = new TcpListener(IPAddress.Loopback, 0);
            fallback.Start();
            _listener = fallback;
            return ((IPEndPoint)fallback.LocalEndpoint).Port;
        }

        private static void WaitForServerReady(int port)
        {
            for (int i = 0; i < 20; i++)
            {
                if (IsExistingInstanceRunning(port)) return;
                Thread.Sleep(50);
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
            const string emptyDbJson = "{\"owners\":[],\"properties\":[],\"contracts\":[],\"payments\":[],\"maintenances\":[],\"settlements\":[],\"handoverNotes\":[],\"backupSnapshots\":[]}";
            lock (DbLock)
            {
                try
                {
                    if (File.Exists(_portableDbPath))
                    {
                        string content = File.ReadAllText(_portableDbPath, Encoding.UTF8).Trim();
                        if (content.Contains("MAT-FACA-001") && content.Contains("CC 79.452.810"))
                        {
                            WriteFileAtomically(_portableDbPath, emptyDbJson);
                            WriteFileAtomically(_localAppDbPath, emptyDbJson);
                            return emptyDbJson;
                        }
                        if (content.StartsWith("{") && content.EndsWith("}"))
                        {
                            return content;
                        }
                    }
                    if (File.Exists(_localAppDbPath))
                    {
                        string content = File.ReadAllText(_localAppDbPath, Encoding.UTF8).Trim();
                        if (content.Contains("MAT-FACA-001") && content.Contains("CC 79.452.810"))
                        {
                            WriteFileAtomically(_portableDbPath, emptyDbJson);
                            WriteFileAtomically(_localAppDbPath, emptyDbJson);
                            return emptyDbJson;
                        }
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
                return emptyDbJson;
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

        private static void LaunchDesktopShell(string url)
        {
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
                            Arguments = "--app=\"" + url + "\" --window-size=1440,900",
                            UseShellExecute = false
                        };
                        Process.Start(psi);
                        return;
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

                    if (method == "GET" && path == "/api/health")
                    {
                        byte[] healthBytes = Encoding.UTF8.GetBytes("{\"status\":\"ok\"}");
                        WriteResponse(stream, "200 OK", "application/json; charset=utf-8", healthBytes);
                        return;
                    }

                    _lastActivityUtc = DateTime.UtcNow;

                    if (method == "POST" && path == "/api/heartbeat")
                    {
                        _clientEverConnected = true;
                        byte[] hbBytes = Encoding.UTF8.GetBytes("{\"alive\":true}");
                        WriteResponse(stream, "200 OK", "application/json; charset=utf-8", hbBytes);
                        return;
                    }

                    if (method == "POST" && path == "/api/local-db")
                    {
                        _clientEverConnected = true;
                        string body = ReadExactBytesAsUtf8(stream, contentLength);
                        SaveLocalDatabaseJson(body);
                        byte[] okBytes = Encoding.UTF8.GetBytes("{\"ok\":true}");
                        WriteResponse(stream, "200 OK", "application/json; charset=utf-8", okBytes);
                        return;
                    }

                    if (method == "GET" && path == "/api/init-db.js")
                    {
                        _clientEverConnected = true;
                        string dbJson = ReadLocalDatabaseJson();
                        string js =
                            "window.__INMOCONTROL_DESKTOP_EXE__ = true;\n" +
                            "window.__INMOCONTROL_INITIAL_DB__ = " + dbJson + ";\n" +
                            "setInterval(function(){ fetch('/api/heartbeat', { method: 'POST', keepalive: true }).catch(function(){}); }, 3000);\n";
                        byte[] jsBytes = Encoding.UTF8.GetBytes(js);
                        WriteResponse(stream, "200 OK", "application/javascript; charset=utf-8", jsBytes);
                        return;
                    }

                    if (method == "GET" && path == "/assets/app.css")
                    {
                        _clientEverConnected = true;
                        byte[] cssBytes = ReadEmbeddedResource("app.css");
                        WriteResponse(stream, "200 OK", "text/css; charset=utf-8", cssBytes);
                        return;
                    }

                    if (method == "GET" && path == "/assets/app.js")
                    {
                        _clientEverConnected = true;
                        byte[] jsBytes = ReadEmbeddedResource("app.js");
                        WriteResponse(stream, "200 OK", "application/javascript; charset=utf-8", jsBytes);
                        return;
                    }

                    // Default SPA fallback: serve index.html
                    _clientEverConnected = true;
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
