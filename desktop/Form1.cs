using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace InmoControl
{
    public class Form1 : Form
    {
        private WebView2? webView;
        private HttpListener? httpListener;
        private int serverPort = 54321;
        private string distPath = "";
        private string dataPath = "";
        private string dbFilePath = "";

        public Form1()
        {
            InitializeComponent();
            ResolvePaths();
            StartLocalServer();
            InitializeWebViewAsync();
        }

        private void InitializeComponent()
        {
            this.Text = "InmoControl - SilvaCooperativa";
            this.Width = 1360;
            this.Height = 860;
            this.MinimumSize = new System.Drawing.Size(1024, 700);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = System.Drawing.Color.FromArgb(15, 23, 42); // Slate-900 Dark

            this.webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            this.Controls.Add(this.webView);
            this.FormClosing += Form1_FormClosing;
        }

        private void ResolvePaths()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            
            // Check local dist locations
            string[] possibleDistPaths = new[]
            {
                Path.Combine(baseDir, "dist"),
                Path.Combine(baseDir, "..", "..", "..", "..", "dist"),
                Path.Combine(Directory.GetCurrentDirectory(), "dist")
            };

            foreach (var p in possibleDistPaths)
            {
                if (Directory.Exists(p))
                {
                    distPath = Path.GetFullPath(p);
                    break;
                }
            }

            if (string.IsNullOrEmpty(distPath))
            {
                distPath = Path.Combine(baseDir, "dist");
                Directory.CreateDirectory(distPath);
            }

            // Data directory
            string[] possibleDataDirs = new[]
            {
                Path.Combine(baseDir, "data"),
                Path.Combine(baseDir, "..", "..", "..", "..", "data"),
                Path.Combine(Directory.GetCurrentDirectory(), "data")
            };

            foreach (var d in possibleDataDirs)
            {
                if (Directory.Exists(d))
                {
                    dataPath = Path.GetFullPath(d);
                    break;
                }
            }

            if (string.IsNullOrEmpty(dataPath))
            {
                dataPath = Path.Combine(baseDir, "data");
            }

            Directory.CreateDirectory(dataPath);
            dbFilePath = Path.Combine(dataPath, "database.json");

            if (!File.Exists(dbFilePath))
            {
                string initialDb = "{\n  \"arrendadores\": [],\n  \"propiedades\": [],\n  \"arrendatarios\": [],\n  \"transacciones\": [],\n  \"mantenimientos\": [],\n  \"recibos_pago\": []\n}";
                File.WriteAllText(dbFilePath, initialDb, Encoding.UTF8);
            }
        }

        private void StartLocalServer()
        {
            try
            {
                httpListener = new HttpListener();
                httpListener.Prefixes.Add($"http://localhost:{serverPort}/");
                httpListener.Start();
                Task.Run(ListenLoop);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error al iniciar el servidor interno: {ex.Message}", "InmoControl", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private async Task ListenLoop()
        {
            while (httpListener != null && httpListener.IsListening)
            {
                try
                {
                    var context = await httpListener.GetContextAsync();
                    ProcessRequest(context);
                }
                catch
                {
                    break;
                }
            }
        }

        private void ProcessRequest(HttpListenerContext context)
        {
            try
            {
                var req = context.Request;
                var res = context.Response;

                // Handle CORS & Headers
                res.AddHeader("Access-Control-Allow-Origin", "*");
                res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 200;
                    res.Close();
                    return;
                }

                // Database API Route: /api/db
                if (req.Url != null && req.Url.AbsolutePath.Equals("/api/db", StringComparison.OrdinalIgnoreCase))
                {
                    if (req.HttpMethod == "GET")
                    {
                        string content = File.Exists(dbFilePath) ? File.ReadAllText(dbFilePath, Encoding.UTF8) : "{}";
                        byte[] buffer = Encoding.UTF8.GetBytes(content);
                        res.ContentType = "application/json; charset=utf-8";
                        res.ContentLength64 = buffer.Length;
                        res.OutputStream.Write(buffer, 0, buffer.Length);
                        res.Close();
                        return;
                    }
                    else if (req.HttpMethod == "POST")
                    {
                        using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                        string body = reader.ReadToEnd();
                        File.WriteAllText(dbFilePath, body, Encoding.UTF8);

                        byte[] okBuffer = Encoding.UTF8.GetBytes("{\"success\":true}");
                        res.ContentType = "application/json";
                        res.ContentLength64 = okBuffer.Length;
                        res.OutputStream.Write(okBuffer, 0, okBuffer.Length);
                        res.Close();
                        return;
                    }
                }

                // Static Web Assets Route (dist/)
                string requestedPath = req.Url != null ? req.Url.AbsolutePath.TrimStart('/') : "";
                if (string.IsNullOrEmpty(requestedPath))
                {
                    requestedPath = "index.html";
                }

                string filePath = Path.Combine(distPath, requestedPath);

                // Fallback for SPA Routing
                if (!File.Exists(filePath))
                {
                    filePath = Path.Combine(distPath, "index.html");
                }

                if (File.Exists(filePath))
                {
                    byte[] fileBytes = File.ReadAllBytes(filePath);
                    string ext = Path.GetExtension(filePath).ToLowerInvariant();
                    res.ContentType = ext switch
                    {
                        ".html" => "text/html; charset=utf-8",
                        ".js" => "application/javascript",
                        ".css" => "text/css",
                        ".svg" => "image/svg+xml",
                        ".png" => "image/png",
                        ".jpg" or ".jpeg" => "image/jpeg",
                        ".json" => "application/json",
                        _ => "application/octet-stream"
                    };
                    res.ContentLength64 = fileBytes.Length;
                    res.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                    res.Close();
                }
                else
                {
                    res.StatusCode = 404;
                    res.Close();
                }
            }
            catch
            {
                try { context.Response.Close(); } catch { }
            }
        }

        private async void InitializeWebViewAsync()
        {
            if (webView == null) return;

            try
            {
                var env = await CoreWebView2Environment.CreateAsync(userDataFolder: Path.Combine(dataPath, "webview_cache"));
                await webView.EnsureCoreWebView2Async(env);

                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;

                webView.Source = new Uri($"http://localhost:{serverPort}/");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error al inicializar la vista web: {ex.Message}", "InmoControl", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void Form1_FormClosing(object? sender, FormClosingEventArgs e)
        {
            try
            {
                httpListener?.Stop();
                httpListener?.Close();
            }
            catch { }
        }
    }
}
