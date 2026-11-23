import AppKit
import WebKit
import UniformTypeIdentifiers

// Sirve la web empaquetada desde app://local/ (evita problemas de módulos ES con file://)
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist)); return
        }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                   headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)"])!
        task.didReceive(resp); task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class Bridge: NSObject, WKScriptMessageHandler {
    weak var window: NSWindow?
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let body = m.body as? String else { return }
        if body == "drag", let w = window, let e = NSApp.currentEvent { w.performDrag(with: e) }
        // tema elegido en la web: el cristal nativo y la barra lo siguen
        if body.hasPrefix("theme:") {
            switch body.dropFirst(6) {
            case "light": NSApp.appearance = NSAppearance(named: .aqua)
            case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
            default: NSApp.appearance = nil
            }
            (NSApp.delegate as? AppDelegate)?.placeLights()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    let bridge = Bridge()

    func applicationDidFinishLaunching(_ n: Notification) {
        // Tamaño fijo apaisado: ni se redimensiona ni entra en pantalla completa
        let size = NSSize(width: 960, height: 640)
        window = NSWindow(contentRect: NSRect(origin: .zero, size: size),
                          styleMask: [.titled, .closable, .miniaturizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isOpaque = false
        window.backgroundColor = .clear
        window.collectionBehavior = [.fullScreenNone]
        window.setFrameAutosaveName("HechoFixed")   // recuerda solo la posición
        if !window.setFrameUsingName("HechoFixed") { window.center() }
        window.setContentSize(size)

        // Cristal nativo detrás de todo
        let glass = NSVisualEffectView()
        glass.material = .underWindowBackground
        glass.blendingMode = .behindWindow
        glass.state = .followsWindowActiveState
        window.contentView = glass

        let cfg = WKWebViewConfiguration()
        let webRoot = Bundle.main.resourceURL!.appendingPathComponent("web")
        cfg.setURLSchemeHandler(BundleSchemeHandler(root: webRoot), forURLScheme: "app")
        cfg.userContentController.add(bridge, name: "native")
        cfg.websiteDataStore = .default()
        bridge.window = window

        let web = WKWebView(frame: glass.bounds, configuration: cfg)
        web.autoresizingMask = [.width, .height]
        web.setValue(false, forKey: "drawsBackground")
        web.underPageBackgroundColor = .clear
        glass.addSubview(web)
        web.load(URLRequest(url: URL(string: "app://local/index.html")!))

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // AppKit recoloca los semáforos cuando le apetece: los devolvemos a su sitio
        placeLights()
        let nc = NotificationCenter.default
        for name in [NSWindow.didResizeNotification, NSWindow.didBecomeKeyNotification,
                     NSWindow.didResignKeyNotification, NSWindow.didChangeScreenNotification] {
            nc.addObserver(forName: name, object: window, queue: .main) { [weak self] _ in self?.placeLights() }
        }
        if let bar = window.standardWindowButton(.closeButton)?.superview {
            bar.postsFrameChangedNotifications = true
            nc.addObserver(forName: NSView.frameDidChangeNotification, object: bar, queue: .main) { [weak self] _ in
                DispatchQueue.main.async { self?.placeLights() }
            }
        }
    }

    /// Semáforos dentro de la barra lateral flotante (que empieza a 12 pt del borde), con su margen
    private let lightsInset: CGFloat = 12 + 14
    private let titlebarHeight: CGFloat = 44
    private var lightsStep: CGFloat?

    func placeLights() {
        guard let close = window.standardWindowButton(.closeButton),
              let bar = close.superview, let container = bar.superview else { return }
        let types: [NSWindow.ButtonType] = [.closeButton, .miniaturizeButton, .zoomButton]
        let buttons = types.compactMap { window.standardWindowButton($0) }
        if lightsStep == nil, buttons.count > 1 { lightsStep = buttons[1].frame.minX - buttons[0].frame.minX }
        let step = lightsStep ?? 20

        let frame = NSRect(x: 0, y: window.frame.height - titlebarHeight, width: window.frame.width, height: titlebarHeight)
        if container.frame != frame { container.frame = frame }
        if bar.frame != container.bounds { bar.frame = container.bounds }
        for (i, b) in buttons.enumerated() {
            let o = NSPoint(x: lightsInset + CGFloat(i) * step, y: bar.bounds.height - lightsInset - b.frame.height)
            if b.frame.origin != o { b.setFrameOrigin(o) }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }
}

// Menú mínimo para que funcionen ⌘C/⌘V/⌘A/⌘Q
func buildMenu() -> NSMenu {
    let main = NSMenu()
    let appItem = NSMenuItem(); main.addItem(appItem)
    let app = NSMenu()
    app.addItem(withTitle: "Ocultar Hecho", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    app.addItem(.separator())
    app.addItem(withTitle: "Salir de Hecho", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = app

    let editItem = NSMenuItem(); main.addItem(editItem)
    let edit = NSMenu(title: "Edición")
    edit.addItem(withTitle: "Deshacer", action: Selector(("undo:")), keyEquivalent: "z")
    edit.addItem(withTitle: "Rehacer", action: Selector(("redo:")), keyEquivalent: "Z")
    edit.addItem(.separator())
    edit.addItem(withTitle: "Cortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Pegar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Seleccionar todo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit

    let winItem = NSMenuItem(); main.addItem(winItem)
    let win = NSMenu(title: "Ventana")
    win.addItem(withTitle: "Minimizar", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    win.addItem(withTitle: "Cerrar", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    winItem.submenu = win
    return main
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.mainMenu = buildMenu()
app.run()
