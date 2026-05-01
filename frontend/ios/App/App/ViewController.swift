import UIKit
import Capacitor

class ViewController: CAPBridgeViewController, UIScrollViewDelegate {
    override func viewDidLoad() {
        super.viewDidLoad()

        // Match the app's dark background so pull-down overscroll shows dark, not white
        let appBackground = UIColor(red: 0.094, green: 0.094, blue: 0.122, alpha: 1.0) // #18181f
        view.backgroundColor = appBackground
        webView?.backgroundColor = appBackground
        webView?.isOpaque = false
        webView?.scrollView.backgroundColor = appBackground

        // Disable native scroll entirely — all scrolling is handled by CSS overflow containers
        webView?.scrollView.isScrollEnabled = false
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.alwaysBounceHorizontal = false

        // Lock zoom so keyboard/layout events cannot change the viewport scale
        webView?.scrollView.minimumZoomScale = 1.0
        webView?.scrollView.maximumZoomScale = 1.0
        webView?.scrollView.zoomScale = 1.0
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(SpeechRecognitionPlugin())
        webView?.scrollView.delegate = self
    }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        // Snap back to 1.0 if anything tries to zoom the WKWebView (e.g. keyboard layout changes)
        scrollView.setZoomScale(1.0, animated: false)
    }
}
