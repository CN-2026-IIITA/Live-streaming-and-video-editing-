"use client";

import { useEffect, useRef, useState } from "react";

const SERVER = "http://10.174.48.106:3000";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

export default function ViewerUI() {
  const [logs, setLogs] = useState<string[]>(["ready"]);
  const [state, setState] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [reelStatus, setReelStatus] = useState("");
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);

  const log = (msg: string) => setLogs(p => [...p.slice(-40), msg]);

  const attachStream = (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    // Separate audio tracks and play them via Audio element
    // This fixes mobile sound issues where video.muted blocks audio
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    log("video tracks: " + videoTracks.length + ", audio tracks: " + audioTracks.length);

    // Attach video-only stream to video element
    if (videoTracks.length > 0) {
      const videoOnlyStream = new MediaStream(videoTracks);
      video.srcObject = videoOnlyStream;
      video.muted = true; // video element always muted
      video.play().then(() => {
        log("video playing ✅");
        setState("live");
      }).catch(e => log("video play err: " + e.message));
    }

    // Play audio separately via Audio element — bypasses mobile mute restriction
    if (audioTracks.length > 0 && audioRef.current) {
      const audioOnlyStream = new MediaStream(audioTracks);
      audioRef.current.srcObject = audioOnlyStream;
      audioRef.current.volume = 1.0;
      audioRef.current.play().then(() => {
        log("audio playing ✅");
        setIsMuted(false);
      }).catch(e => {
        log("audio blocked, tap unmute: " + e.message);
        setIsMuted(true);
      });
    }
  };

  const connect = () => {
    setState("connecting");
    log("connecting...");

    import("socket.io-client").then(({ io }) => {
      const socket = io(SERVER, { transports: ["polling", "websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        log("socket ✅ " + socket.id);
        socket.emit("viewer-ready");
      });

      socket.on("connect_error", (e: any) => {
        log("socket ❌ " + e.message);
        setState("ended");
      });

      socket.on("reel-ready", (filename: string) => {
        setReelStatus("✅ Reel ready: " + filename);
        log("reel ready: " + filename);
      });

      socket.on("reel-error", (err: string) => {
        setReelStatus("❌ " + err);
        log("reel error: " + err);
      });

      socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
        log("offer ✅");
        if (pcRef.current) pcRef.current.close();
        pendingRef.current = [];
        remoteSetRef.current = false;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        const remoteStream = new MediaStream();

        pc.ontrack = (e) => {
          log("track: " + e.track.kind);
          remoteStream.addTrack(e.track);
          // wait for both audio and video before attaching
          const hasVideo = remoteStream.getVideoTracks().length > 0;
          const hasAudio = remoteStream.getAudioTracks().length > 0;
          if (hasVideo) attachStream(remoteStream);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("candidate", e.candidate);
        };

        pc.onconnectionstatechange = () => {
          log("rtc: " + pc.connectionState);
        };

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          remoteSetRef.current = true;
          for (const c of pendingRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          pendingRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", answer);
          log("answer sent ✅");
        } catch (e: any) {
          log("offer err ❌ " + e.message);
        }
      });

      socket.on("candidate", async (c: RTCIceCandidateInit) => {
        if (remoteSetRef.current && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        } else {
          pendingRef.current.push(c);
        }
      });

      socket.on("broadcaster-stopped", () => {
        log("stream ended");
        setState("ended");
      });
    });
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMuted = !isMuted;
    audioRef.current.muted = newMuted;
    if (!newMuted) {
      // Force play on unmute — needed on some mobile browsers
      audioRef.current.play().catch(() => {});
    }
    setIsMuted(newMuted);
  };

  const makeReel = () => {
    if (!socketRef.current) return;
    // Send viewer-make-reel — server routes this to the broadcaster's recording
    socketRef.current.emit("viewer-make-reel");
    setReelStatus("⏳ Processing reel...");
    log("reel requested ✅");
  };

  // ── TAP TO WATCH ──────────────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div onClick={connect} style={{ minHeight: "100vh", background: "#080b10", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, cursor: "pointer" }}>
        <div style={{ fontSize: 72 }}>📡</div>
        <div style={{ color: "#00ddb4", fontFamily: "monospace", fontSize: 20, letterSpacing: 4 }}>TAP TO WATCH</div>
        <div style={{ color: "#334155", fontFamily: "monospace", fontSize: 11, letterSpacing: 2 }}>STREAMFORGE LIVE</div>
      </div>
    );
  }

  // ── MAIN VIEWER ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080b10", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 12px", fontFamily: "monospace", color: "#fff" }}>

      {/* Hidden audio element for separate audio playback */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 380, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: "#00ddb4", fontSize: 13, letterSpacing: 3 }}>⬡ STREAMFORGE</div>
        <div style={{
          padding: "4px 12px", borderRadius: 2, fontSize: 11, letterSpacing: 2,
          background: state === "live" ? "rgba(255,61,90,.1)" : "transparent",
          border: `1px solid ${state === "live" ? "rgba(255,61,90,.5)" : "#1e293b"}`,
          color: state === "live" ? "#ff3d5a" : "#64748b",
        }}>
          {state === "live" ? "● LIVE" : state === "connecting" ? "⏳ CONNECTING" : "⏹ ENDED"}
        </div>
      </div>

      {/* Video */}
      <div style={{ width: "100%", maxWidth: 380, aspectRatio: "9/16", background: "#0d1117", borderRadius: 8, overflow: "hidden", position: "relative", border: "1px solid #1a2332", marginBottom: 12 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {state !== "live" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#1e293b" }}>
            <div style={{ fontSize: 48 }}>📡</div>
            <div style={{ fontSize: 11, letterSpacing: 2 }}>
              {state === "ended" ? "STREAM ENDED" : "WAITING FOR STREAM..."}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ width: "100%", maxWidth: 380, display: "flex", gap: 10, marginBottom: 10 }}>
        <button onClick={toggleMute} style={{
          flex: 1, padding: "13px 8px", border: "none", borderRadius: 3, cursor: "pointer",
          background: isMuted ? "linear-gradient(135deg,#1a0000,#2a0000)" : "linear-gradient(135deg,#003322,#004433)",
          color: isMuted ? "#ff4444" : "#00ddb4",
          fontFamily: "monospace", fontSize: 12, letterSpacing: 2,
          outline: `1px solid ${isMuted ? "#ff444455" : "#00ddb455"}`,
        }}>
          {isMuted ? "🔇 UNMUTE" : "🔊 SOUND ON"}
        </button>

        <button onClick={makeReel} style={{
          flex: 1, padding: "13px 8px", border: "none", borderRadius: 3, cursor: "pointer",
          background: "linear-gradient(135deg,#4f00b8,#7c3aed)",
          color: "#fff", fontFamily: "monospace", fontSize: 12, letterSpacing: 2,
        }}>
          ✦ MAKE REEL
        </button>
      </div>

      {/* Reel status */}
      {reelStatus !== "" && (
        <div style={{ width: "100%", maxWidth: 380, padding: "8px 12px", background: "#0d1117", border: "1px solid #1a2332", borderRadius: 4, marginBottom: 10, fontSize: 11, color: reelStatus.includes("❌") ? "#ff4444" : "#00ddb4" }}>
          {reelStatus}
        </div>
      )}

      {/* Debug log */}
      <div style={{ width: "100%", maxWidth: 380, background: "#0a0a0a", border: "1px solid #111", borderRadius: 8, padding: 10 }}>
        <div style={{ color: "#1e293b", fontSize: 10, marginBottom: 6, letterSpacing: 2 }}>LOG</div>
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.includes("❌") ? "#ff4444" : l.includes("✅") ? "#00ff88" : "#1e293b", fontSize: 10, lineHeight: 1.8 }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
