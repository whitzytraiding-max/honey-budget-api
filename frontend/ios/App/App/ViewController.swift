import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        // Match the app's dark background so pull-down overscroll shows dark, not white
        let appBackground = UIColor(red: 0.094, green: 0.094, blue: 0.122, alpha: 1.0) // #18181f
        view.backgroundColor = appBackground
        webView?.backgroundColor = appBackground
        webView?.isOpaque = false
        webView?.scrollView.backgroundColor = appBackground

        // Disable the rubber-band bounce completely
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.alwaysBounceHorizontal = false
    }
}
