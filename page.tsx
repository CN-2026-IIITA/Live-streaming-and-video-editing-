"use client";

import { useEffect, useRef, useState } from "react";

export default function ViewerPage() {
  const [logs, setLogs] = useState<string[]>(["[init] Component rendered ✅"]);
  const [socketStatus, setSocketStatus] = useState("not started");
  const [offerReceived, setOfferReceived] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const log = (msg: string) => {
    console.log(msg);
    setLogs(p => [...p, msg]);
  };

  useEffect(() => {
    log("[1] useEffect fired ✅");
    log("[2] window exists: " + (typeof window !== "undefined"));
    log("[3] UA: " + navigator.userAgent.slice(0, 60));

    // Test basic network reach
    fetch("http://10.174.48.106:3000")
      .then(() => log("[net] Reached server ✅"))
      .catch((e) => log("[net] Cannot reach server ❌: " + e.message));

    log("[4] Starting dynamic import of socket.io-client...");

    import("socket.io-client")
      .then(({ io }) => {
        log("[5] socket.io-client loaded ✅");

        const socket = io("http://10.174.48.106:3000", {
          transports: ["polling", "websocket"],
          timeout: 10000,
        });

        log("[6] socket instance created, waiting for connect...");

        const pendingCandidates: any[] = [];
        let remoteSet = false;

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });

        log("[7] RTCPeerConnection created ✅");

        pc.ontrack = (e) => {
          log("[8] Got video track ✅ STREAM ACTIVE");
          if (videoRef.current) {
            videoRef.current.srcObject = e.streams[0];
            setVideoStarted(true);
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            log("[ICE] Sending candidate");
            socket.emit("candidate", e.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          log("[WebRTC] state: " + pc.connectionState);
        };

        socket.on("connect", () => {
          log("[9] Socket connected ✅ id=" + socket.id);
          setSocketStatus("connected ✅");
          socket.emit("viewer-ready");
          log("[10] viewer-ready sent ✅");
        });

        socket.on("connect_error", (e: any) => {
          log("[ERR] connect_error ❌: " + e.message);
          setSocketStatus("error: " + e.message);
        });

        socket.on("disconnect", (reason: string) => {
          log("[ERR] Disconnected: " + reason);
        });

        socket.on("offer", async (offer: any) => {
          log("[11] Offer received ✅");
          setOfferReceived(true);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            remoteSet = true;
            for (const c of pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.length = 0;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", answer);
            log("[12] Answer sent ✅");
          } catch (e: any) {
            log("[ERR] Offer error ❌: " + e.message);
          }
        });

        socket.on("candidate", async (c: any) => {
          if (remoteSet) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e: any) {
              log("[ERR] ICE ❌: " + e.message);
            }
          } else {
            pendingCandidates.push(c);
          }
        });
      })
      .catch((e) => {
        log("[ERR] Dynamic import FAILED ❌: " + e.message);
        log("[ERR] Stack: " + (e.stack ?? "none").slice(0, 200));
      });

    // Catch any unhandled errors globally
    const handleError = (e: ErrorEvent) => log("[GLOBAL ERR] " + e.message);
    const handleUnhandled = (e: PromiseRejectionEvent) =>
      log("[UNHANDLED PROMISE] " + String(e.reason));

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandled);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandled);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#000", padding: "20px", fontFamily: "monospace", color: "#fff" }}>
      <h2 style={{ color: "#00ff88", marginBottom: 16, fontSize: 16 }}>STREAMFORGE VIEWER — DEBUG</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Socket", ok: socketStatus.includes("✅") },
          { label: "Offer",  ok: offerReceived },
          { label: "Video",  ok: videoStarted },
        ].map(({ label, ok }) => (
          <div key={label} style={{ padding: "6px 14px", borderRadius: 4, background: ok ? "#003322" : "#1a0000", border: `1px solid ${ok ? "#00ff88" : "#ff4444"}`, color: ok ? "#00ff88" : "#ff4444", fontSize: 12 }}>
            {ok ? "✅" : "⏳"} {label}
          </div>
        ))}
      </div>

      <div style={{ background: "#111", borderRadius: 8, overflow: "hidden", marginBottom: 16, aspectRatio: "9/16", maxWidth: 320, position: "relative", border: "1px solid #222" }}>
        <video ref={videoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {!videoStarted && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#333" }}>
            <div style={{ fontSize: 40 }}>📡</div>
            <div style={{ fontSize: 11 }}>WAITING FOR STREAM</div>
          </div>
        )}
      </div>

      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: 12, maxWidth: 360 }}>
        <div style={{ color: "#555", fontSize: 10, marginBottom: 8 }}>DEBUG LOG ({logs.length} entries)</div>
        {logs.map((l, i) => (
          <div key={i} style={{
            color: l.includes("❌") ? "#ff4444" : l.includes("✅") ? "#00ff88" : "#aaaaaa",
            fontSize: 11,
            lineHeight: 1.9,
          }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
