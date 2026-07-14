import Foundation
import Capacitor
import Network

/** UDP snapshot receiver for battle v2 (iOS) — mirrors Android BattleUdpPlugin. */
@objc(BattleUdpPlugin)
public class BattleUdpPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BattleUdpPlugin"
    public let jsName = "BattleUdp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
    ]

    private var connection: NWConnection?
    private var running = false
    private var routeToken = Data()
    private var keepaliveTimer: DispatchSourceTimer?
    private let routeKeepaliveSec: TimeInterval = 5

    @objc func connect(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty,
              let port = call.getInt("port"), port > 0,
              let token = call.getString("token"), !token.isEmpty else {
            call.reject("host, port, token required")
            return
        }
        disconnectInternal()
        let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: NWEndpoint.Port(integerLiteral: UInt16(port)))
        let params = NWParameters.udp
        params.allowLocalEndpointReuse = true
        let conn = NWConnection(to: endpoint, using: params)
        connection = conn
        running = true
        let reg = String(token.prefix(32)).data(using: .utf8) ?? Data()
        routeToken = reg
        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            if case .ready = state {
                self.sendRouteToken(conn, reg)
                call.resolve(["ok": true])
                self.startRouteKeepalive(conn)
                self.recvLoop(conn)
            } else if case .failed(let err) = state {
                call.reject(err.localizedDescription)
            }
        }
        conn.start(queue: DispatchQueue(label: "BattleUdp"))
    }

    private func sendRouteToken(_ conn: NWConnection, _ reg: Data) {
        conn.send(content: reg, completion: .contentProcessed { _ in })
    }

    private func startRouteKeepalive(_ conn: NWConnection) {
        keepaliveTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue(label: "BattleUdpKeepalive"))
        timer.schedule(deadline: .now() + routeKeepaliveSec, repeating: routeKeepaliveSec)
        timer.setEventHandler { [weak self] in
            guard let self = self, self.running else { return }
            self.sendRouteToken(conn, self.routeToken)
        }
        timer.resume()
        keepaliveTimer = timer
    }

    private func recvLoop(_ conn: NWConnection) {
        guard running else { return }
        conn.receiveMessage { [weak self] data, _, _, err in
            guard let self = self, self.running else { return }
            if let data = data, !data.isEmpty {
                let b64 = data.base64EncodedString()
                self.notifyListeners("packet", data: ["data": b64])
            }
            if err == nil {
                self.recvLoop(conn)
            }
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        disconnectInternal()
        call.resolve()
    }

    private func disconnectInternal() {
        running = false
        keepaliveTimer?.cancel()
        keepaliveTimer = nil
        connection?.cancel()
        connection = nil
    }

    deinit {
        disconnectInternal()
    }
}
