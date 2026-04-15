import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupWebRTC } from "../hook/useGroupWebRTC";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import toast from "react-hot-toast";

/* ── Format mm:ss ── */
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function GroupCallPage() {
  const navigate = useNavigate();
  const { groupCall, leaveGroupCallAction } = useCallStore();
  const { authUser } = useAuthStore();

  const [muted, setMuted]     = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // participants: Map<userId, { userInfo, audioRef }>
  const [participants, setParticipants] = useState(new Map());
  const audioRefs = useRef({}); // userId → HTMLAudioElement

  // ── Thêm participant (merge info, không override nếu đã có đủ thông tin) ──
  const addParticipant = useCallback((userId, userInfo = {}) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId) ?? {};
      // Merge: giữ fullName/profilePic nếu đã có, chỉ override bằng giá trị mới khi chưa có
      next.set(userId, {
        _id: userId,
        fullName: existing.fullName || userInfo.fullName || "",
        profilePic: existing.profilePic || userInfo.profilePic || "",
      });
      return next;
    });
  }, []);

  // ── Remote stream đến → gắn vào <audio> (giữ userInfo đã có) ──
  const onParticipantStream = useCallback((peerId, stream) => {
    console.log("[GroupCallPage] stream from:", peerId);
    // Chỉ add nếu chưa có (tránh override userInfo đã có từ onParticipantJoined)
    addParticipant(peerId, { _id: peerId });
    // Gắn stream vào audio element (có thể chưa render, retry)
    const tryAttach = () => {
      const el = audioRefs.current[peerId];
      if (el) {
        el.srcObject = stream;
        el.play().catch((e) => console.warn("play err:", e));
      } else {
        setTimeout(tryAttach, 200);
      }
    };
    tryAttach();
  }, [addParticipant]);

  // ── Participant mới join → update tên/avatar ngay ──
  const onParticipantJoined = useCallback((peerId, userInfo) => {
    console.log("[GroupCallPage] participant joined:", peerId, userInfo);
    addParticipant(peerId, userInfo);
  }, [addParticipant]);

  // ── Participant rời ──
  const onParticipantLeft = useCallback((peerId) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    delete audioRefs.current[peerId];
  }, []);

  const { joinCall, cleanup, setMicMuted } = useGroupWebRTC({
    groupCall,
    onParticipantStream,
    onParticipantLeft,
    onParticipantJoined,
    onError: () => toast.error("Không thể truy cập microphone"),
  });

  // ── Timer ──
  useEffect(() => {
    const id = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Join call khi vào trang ──
  useEffect(() => {
    if (!groupCall) return;
    // participants hiện tại là những người đã trong call (không bao gồm mình)
    const existing = groupCall.currentParticipants ?? [];
    existing.forEach((p) => addParticipant(p._id?.toString() ?? p.toString(), p));
    joinCall(existing.map((p) => p._id?.toString() ?? p.toString()));
    return () => cleanup();
  }, []); // eslint-disable-line

  // ── Nếu groupCall bị null từ bên ngoài (mọi người đã rời) → cleanup + về home ──
  useEffect(() => {
    if (!groupCall) {
      cleanup(); // dừng mic
      navigate("/", { replace: true });
    }
  }, [groupCall, navigate]); // eslint-disable-line

  if (!groupCall) return null;

  const handleLeave = () => {
    cleanup();
    leaveGroupCallAction({ callId: groupCall.callId, groupId: groupCall.groupId });
    // groupCall sẽ về null → useEffect tự navigate
  };

  const allParticipants = [
    // Mình
    { _id: authUser._id, fullName: authUser.fullname, profilePic: authUser.profilefic, isMe: true },
    // Remote participants
    ...[...participants.entries()].map(([id, info]) => ({
      _id: id,
      fullName: info?.fullName || "Member",
      profilePic: info?.profilePic,
      isMe: false,
    })),
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,201,255,0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(99,201,255,0); }
        }
        .participant-card {
          animation: fadeIn 0.4s ease both;
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
          padding: "48px 24px 52px",
          background: "linear-gradient(160deg, #0f1c2e 0%, #152234 45%, #0c2136 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decorative blobs */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 20% 20%, rgba(37,99,235,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 60% at 80% 80%, rgba(14,165,233,0.12) 0%, transparent 70%)",
        }} />

        {/* Top: group name + timer */}
        <div style={{ textAlign: "center", zIndex: 1, animation: "fadeIn 0.5s ease both" }}>
          <p style={{ color: "rgba(148,210,255,0.75)", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>
            {groupCall.callType === "video" ? "📹 Video Call" : "🎙 Group Voice Call"}
          </p>
          <h2 style={{ color: "#f0f9ff", fontSize: 20, fontWeight: 600, margin: "6px 0 2px" }}>
            {groupCall.groupName || "Group Call"}
          </h2>
          <p style={{ color: "rgba(148,210,255,0.6)", fontSize: 14, margin: 0 }}>{fmt(elapsed)}</p>
        </div>

        {/* Center: participant grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(allParticipants.length, 3)}, 1fr)`,
            gap: 20,
            maxWidth: 540,
            width: "100%",
            zIndex: 1,
            animation: "fadeIn 0.6s 0.1s ease both",
            opacity: 0,
          }}
        >
          {allParticipants.map((p) => (
            <div
              key={p._id}
              className="participant-card"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
            >
              <img
                src={p.profilePic || "/avatar.png"}
                alt={p.fullName}
                style={{
                  width: 72, height: 72, borderRadius: "50%", objectFit: "cover",
                  border: `2px solid ${p.isMe ? "rgba(99,201,255,0.8)" : "rgba(255,255,255,0.2)"}`,
                  animation: "pulse-ring 2.5s ease-in-out infinite",
                }}
              />
              <p style={{ color: p.isMe ? "#63c9ff" : "#d0e8ff", fontSize: 12, fontWeight: 500, margin: 0, textAlign: "center" }}>
                {p.isMe ? "Bạn" : p.fullName}
              </p>

              {/* Hidden audio element for remote streams */}
              {!p.isMe && (
                <audio
                  autoPlay
                  playsInline
                  ref={(el) => { if (el) audioRefs.current[p._id] = el; }}
                  style={{ display: "none" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Bottom: controls */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 20,
            animation: "fadeIn 0.6s 0.2s ease both", opacity: 0, zIndex: 1,
          }}
        >
          {/* Mute */}
          <button
            onClick={() => { const n = !muted; setMuted(n); setMicMuted(n); }}
            title={muted ? "Unmute" : "Mute"}
            style={{
              width: 60, height: 60, borderRadius: "50%",
              background: muted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.12)",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", backdropFilter: "blur(8px)", transition: "transform 0.15s, background 0.2s",
            }}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Leave */}
          <button
            onClick={handleLeave}
            title="Leave Call"
            style={{
              width: 70, height: 70, borderRadius: "50%",
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", backdropFilter: "blur(8px)", transition: "transform 0.15s",
            }}
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </div>
    </>
  );
}
