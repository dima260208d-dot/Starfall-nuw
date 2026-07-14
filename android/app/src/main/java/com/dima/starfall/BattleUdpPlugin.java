package com.dima.starfall;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** UDP snapshot receiver for battle v2 — registers route token with worker. */
@CapacitorPlugin(name = "BattleUdp")
public class BattleUdpPlugin extends Plugin {
    private static final int ROUTE_KEEPALIVE_MS = 5000;

    private DatagramSocket socket;
    private Thread recvThread;
    private ScheduledExecutorService keepalive;
    private final AtomicBoolean running = new AtomicBoolean(false);

    @PluginMethod
    public void connect(PluginCall call) {
        String host = call.getString("host", "");
        Integer portBox = call.getInt("port");
        int port = portBox != null ? portBox : 0;
        String token = call.getString("token", "");
        if (host.isEmpty() || port <= 0 || token.isEmpty()) {
            call.reject("host, port, token required");
            return;
        }
        try {
            disconnectInternal();
            socket = new DatagramSocket();
            socket.connect(InetAddress.getByName(host), port);
            byte[] reg = token.substring(0, Math.min(32, token.length())).getBytes(StandardCharsets.UTF_8);
            sendRouteToken(reg);
            running.set(true);
            keepalive = Executors.newSingleThreadScheduledExecutor();
            keepalive.scheduleAtFixedRate(() -> {
                if (!running.get() || socket == null || socket.isClosed()) return;
                try {
                    sendRouteToken(reg);
                } catch (Exception ignored) {
                    // ignore keepalive errors
                }
            }, ROUTE_KEEPALIVE_MS, ROUTE_KEEPALIVE_MS, TimeUnit.MILLISECONDS);
            recvThread = new Thread(this::recvLoop, "BattleUdpRecv");
            recvThread.setDaemon(true);
            recvThread.start();
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "udp connect failed");
        }
    }

    private void recvLoop() {
        byte[] buf = new byte[65507];
        while (running.get() && socket != null && !socket.isClosed()) {
            try {
                DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                socket.receive(pkt);
                int len = pkt.getLength();
                if (len <= 0) continue;
                byte[] data = new byte[len];
                System.arraycopy(pkt.getData(), pkt.getOffset(), data, 0, len);
                JSObject ev = new JSObject();
                ev.put("data", Base64.encodeToString(data, Base64.NO_WRAP));
                notifyListeners("packet", ev);
            } catch (Exception e) {
                break;
            }
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectInternal();
        call.resolve();
    }

    private void sendRouteToken(byte[] reg) throws Exception {
        socket.send(new DatagramPacket(reg, reg.length));
    }

    private void disconnectInternal() {
        running.set(false);
        if (keepalive != null) {
            keepalive.shutdownNow();
            keepalive = null;
        }
        if (socket != null) {
            try {
                socket.close();
            } catch (Exception ignored) {
                // ignore
            }
            socket = null;
        }
        if (recvThread != null) {
            recvThread.interrupt();
            recvThread = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        disconnectInternal();
        super.handleOnDestroy();
    }
}
