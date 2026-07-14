import UIKit
import Capacitor

class StarfallBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BattleUdpPlugin())
    }
}
