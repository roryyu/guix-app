import AppKit
import WebKit

// 外壳只加载包内资源，不向 Shader 页面暴露原生执行接口。
final class EditorDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var resourceRoot: URL!
    private var finished = false
    private var testActivity: NSObjectProtocol?
    private let arguments = CommandLine.arguments
    private var smokeScript: String? { argument("--smoke") }

    private func argument(_ key: String) -> String? {
        guard let index = arguments.firstIndex(of: key), arguments.indices.contains(index + 1) else { return nil }
        return arguments[index + 1]
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        installMenus()
        guard let resources = Bundle.main.resourceURL else { fail("找不到应用资源目录"); return }
        resourceRoot = resources.appendingPathComponent("web", isDirectory: true).standardizedFileURL
        let index = resourceRoot.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: index.path) else { fail("缺少编辑器网页，请重新构建应用"); return }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = smokeScript == nil ? .default() : .nonPersistent()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "GLSL Studio · Shader 编辑器"
        window.contentMinSize = NSSize(width: 900, height: 680)
        if arguments.contains("--small-window") { window.setContentSize(window.contentMinSize) }
        window.isReleasedWhenClosed = false
        window.contentView = webView
        window.center()
        if smokeScript == nil {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        } else {
            // 测试窗口保持可见，避免 WebKit 遮挡节流；不激活应用或抢占键盘焦点。
            testActivity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep, reason: "WKWebView GPU 回归测试")
            window.level = .floating
            window.orderFrontRegardless()
            DispatchQueue.main.asyncAfter(deadline: .now() + 60) { [weak self] in
                guard let self = self, !self.finished else { return }
                self.webView.evaluateJavaScript("JSON.stringify({state:document.readyState,hidden:document.hidden,url:location.href,status:document.getElementById('console')?.textContent,progress:window.smokeProgress})") { value, error in
                    self.fail("WKWebView 冒烟测试超时：\(String(describing: value)) / \(String(describing: error))")
                }
            }
        }
        webView.loadFileURL(index, allowingReadAccessTo: resourceRoot)
    }

    private func installMenus() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 GLSL Studio", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏 GLSL Studio", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "退出 GLSL Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)
        let editItem = NSMenuItem()
        let edit = NSMenu(title: "编辑")
        for (title, selector, key) in [("撤销", "undo:", "z"), ("重做", "redo:", "Z"),
                                        ("剪切", "cut:", "x"), ("复制", "copy:", "c"),
                                        ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        editItem.submenu = edit
        main.addItem(editItem)
        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "关闭", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windowMenu
        main.addItem(windowItem)
        NSApp.mainMenu = main
        NSApp.windowsMenu = windowMenu
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if smokeScript != nil { print("WK 导航：\(String(describing: navigationAction.request.url))") }
        guard let url = navigationAction.request.url, url.isFileURL,
              url.standardizedFileURL.path.hasPrefix(resourceRoot.path + "/"),
              navigationAction.targetFrame != nil else { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let path = smokeScript, !finished else { return }
        print("WK 页面加载完成，开始测试")
        do {
            let script = try String(contentsOfFile: path, encoding: .utf8)
            webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .failure(let error): self.fail("WKWebView 测试失败：\(error)")
                case .success(let value):
                    print("WKWEBVIEW_SMOKE_OK \(value)")
                    self.snapshotAndFinish()
                }
            }
        } catch { fail("无法读取测试脚本：\(error)") }
    }

    private func snapshotAndFinish() {
        guard let path = argument("--snapshot") else { finish(); return }
        webView.takeSnapshot(with: nil) { [weak self] image, error in
            guard let self = self else { return }
            guard let data = image?.tiffRepresentation,
                  let bitmap = NSBitmapImageRep(data: data),
                  let png = bitmap.representation(using: .png, properties: [:]) else {
                self.fail("截图失败：\(String(describing: error))"); return
            }
            do {
                try png.write(to: URL(fileURLWithPath: path))
                print("截图：\(path)")
                self.finish()
            } catch { self.fail("保存截图失败：\(error)") }
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        fail("网页加载失败：\(error)")
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        fail("WebKit 内容进程退出，请重新打开应用")
    }
    private func finish() { finished = true; NSApp.terminate(nil) }
    private func fail(_ text: String) {
        guard !finished else { return }
        finished = true
        FileHandle.standardError.write(Data((text + "\n").utf8))
        if smokeScript == nil {
            let alert = NSAlert()
            alert.messageText = "GLSL Studio"
            alert.informativeText = text
            alert.runModal()
        }
        exit(1)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = EditorDelegate()
app.delegate = delegate
app.run()
