import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Phone } from "lucide-react";
import { useWebRTC } from "../hook/useWebRTC";
import toast from "react-hot-toast";
/* ────────────────────────────────────────────────
   Ripple ring – pure CSS animation via inline styles
──────────────────────────────────────────────── */
const Ripple = ({ delay = 0, size = 180 }) => (
  <span
    style={{
      position: "absolute",
      width: size,
      height: size,
      borderRadius: "50%",
      background: "rgba(99,201,255,0.15)",
      animation: `ripple 2.4s ease-out ${delay}s infinite`,
    }}
  />
);

/* ────────────────────────────────────────────────
   Round control button
──────────────────────────────────────────────── */
const CtrlBtn = ({
  onClick,
  title,
  bg = "rgba(255,255,255,0.12)",
  children,
}) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 60,
      height: 60,
      borderRadius: "50%",
      background: bg,
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      backdropFilter: "blur(8px)",
      transition: "transform 0.15s, background 0.2s",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
  >
    {children}
  </button>
);

/* ────────────────────────────────────────────────
   Format seconds → mm:ss
──────────────────────────────────────────────── */
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function CallPage() {
  const navigate = useNavigate();
  const { activeCall, respondCall, endActiveCall } = useCallStore();
  const { authUser } = useAuthStore();

  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const { endCall } = useCallStore();

  const remoteAudioRef = useRef(null);

  const { start, cleanup, setMicMuted } = useWebRTC({
    activeCall,
    onRemoteStream: (stream) => {
      console.log("[CallPage] onRemoteStream received!", stream.getTracks());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(e => console.error("Audio play error:", e));
      }
    },
    onError: () => toast.error("Không thể truy cập microphone"),
  });
  // Timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeCall) return;
    start();
    return () => cleanup();
  }, []);

  // If no active call, go home
  useEffect(() => {
    if (!activeCall) navigate("/", { replace: true });
  }, [activeCall, navigate]);

  if (!activeCall) return null;

  const currentUserId = authUser?._id?.toString();
  const activeSenderId = activeCall?.senderId?.toString() || activeCall?.caller?._id?.toString();
  const isCaller = activeSenderId === currentUserId;

  const peerId = isCaller
    ? (activeCall?.receiveId?.toString() || activeCall?.receiver?._id?.toString())
    : (activeCall?.fromUserId?.toString() || activeSenderId);

  const peer = isCaller
    ? (activeCall.receiver || { _id: peerId, fullName: "Receiver" })
    : (activeCall.caller || { _id: peerId, fullName: "Caller" });

  const handleEndCall = async () => {
    cleanup(); // ← thêm dòng này
    await endCall({ messageId: activeCall.messageId });
    endActiveCall();
    navigate("/", { replace: true });
  };
  return (
    <>
      {/* inject keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes ripple {
          0%   { transform: scale(0.8); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-avatar {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,201,255,0.4); }
          50%       { box-shadow: 0 0 0 14px rgba(99,201,255,0); }
        }
      `}</style>

      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "60px 24px 52px",
          background:
            "linear-gradient(160deg, #0f1c2e 0%, #152234 45%, #0c2136 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background mesh blobs */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 60% 50% at 20% 20%, rgba(37,99,235,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(14,165,233,0.12) 0%, transparent 70%)",
          }}
        />

        {/* ── Top: call type label ── */}
        <p
          style={{
            color: "rgba(148,210,255,0.75)",
            fontSize: 13,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 500,
            animation: "fadeIn 0.5s ease both",
          }}
        >
          {activeCall.callType === "video" ? "📹 Video Call" : "🎙 Voice Call"}
        </p>

        {/* ── Center: avatar + name + timer ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            animation: "fadeIn 0.6s 0.1s ease both",
            opacity: 0,
          }}
        >
          {/* Ripple rings */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 120,
              height: 120,
            }}
          >
            <Ripple delay={0} size={120} />
            <Ripple delay={0.8} size={120} />
            <Ripple delay={1.6} size={120} />

            {/* Avatar */}
            <img
              src={peer?.profilePic || "/avatar.png"}
              alt={peer?.fullName}
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid rgba(99,201,255,0.6)",
                position: "relative",
                zIndex: 1,
                animation: "pulse-avatar 2.5s ease-in-out infinite",
              }}
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                color: "#f0f9ff",
                fontSize: 26,
                fontWeight: 600,
                margin: 0,
              }}
            >
              {peer?.fullName || "Unknown"}
            </h1>
            <p
              style={{
                color: "rgba(148,210,255,0.6)",
                fontSize: 14,
                marginTop: 6,
              }}
            >
              {fmt(elapsed)}
            </p>
          </div>
        </div>

        {/* ── Bottom: controls ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            animation: "fadeIn 0.6s 0.2s ease both",
            opacity: 0,
          }}
        >
          {/* Mute */}
          <CtrlBtn
            title={muted ? "Unmute" : "Mute"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMicMuted(next);
            }}
            bg={muted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.12)"}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </CtrlBtn>

          {/* End Call — big red */}
          <CtrlBtn
            title="End Call"
            onClick={handleEndCall}
            bg="linear-gradient(135deg,#ef4444,#dc2626)"
          >
            <PhoneOff size={26} />
          </CtrlBtn>

          {/* Speaker */}
          <CtrlBtn
            title={speakerOff ? "Speaker On" : "Speaker Off"}
            onClick={() => setSpeakerOff(!speakerOff)}
            bg={speakerOff ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.12)"}
          >
            {speakerOff ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </CtrlBtn>
        </div>
      </div>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
    </>
  );
}
