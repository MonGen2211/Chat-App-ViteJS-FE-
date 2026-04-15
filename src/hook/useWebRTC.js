import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";

const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/**
 * useWebRTC
 *
 * Dùng ref-based pattern để tránh stale-closure.
 * ICE candidates được xếp hàng cho đến khi remoteDescription được set.
 */
export function useWebRTC({ activeCall, onRemoteStream, onError }) {
  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);
  const initDoneRef    = useRef(false);   // true sau khi PC + stream sẵn sàng
  const iceCandQueue   = useRef([]);       // Hàng đợi ICE khi chưa có remoteDesc

  // ── metaRef: luôn fresh, không stale ──
  const metaRef = useRef({});

  const socket   = useAuthStore.getState().socket;
  const authUser = useAuthStore.getState().authUser;

  const currentUserId  = authUser?._id?.toString() ?? "";
  const activeSenderId =
    activeCall?.senderId?.toString() ||
    activeCall?.caller?._id?.toString() ||
    "";

  const isCaller = !!(activeSenderId && activeSenderId === currentUserId);

  const peerId = isCaller
    ? (activeCall?.receiveId?.toString()  || activeCall?.receiver?._id?.toString() || "")
    : (activeCall?.fromUserId?.toString() || activeSenderId || "");

  const messageId = activeCall?.messageId?.toString() ?? "";

  // Cập nhật mỗi render - callback đọc từ đây để luôn tươi
  metaRef.current = { socket, peerId, messageId, isCaller, onRemoteStream, onError };


  // ── Tạo RTCPeerConnection (factory, không có dependency) ──
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = ({ candidate }) => {
      const { socket, peerId, messageId } = metaRef.current;
      if (candidate && peerId) {
        socket.emit("call:ice", { to: peerId, candidate, messageId });
      }
    };

    pc.ontrack = (e) => {
      const { onRemoteStream } = metaRef.current;
      if (e.streams?.[0]) onRemoteStream(e.streams[0]);
    };

    pc.onconnectionstatechange = () =>

    pc.onsignalingstatechange = () =>
     ("[WebRTC] signalingState:", pc.signalingState);

    pcRef.current = pc;
    return pc;
  }, []); // không dependency — dùng metaRef trong callbacks

  // ── Khởi tạo PC + getUserMedia (một lần cho mỗi cuộc gọi) ──
  const initPC = useCallback(async () => {
    if (initDoneRef.current) return pcRef.current;
    initDoneRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
     ("[WebRTC] Mic ready, tracks:", stream.getAudioTracks().length);
      localStreamRef.current = stream;
      const pc = createPC();
      stream.getTracks().forEach((t) => {
       ("[WebRTC] addTrack:", t.kind);
        pc.addTrack(t, stream);
      });
      return pc;
    } catch (err) {
      initDoneRef.current = false; // cho phép retry
      console.error("[WebRTC] initPC error:", err);
      metaRef.current.onError?.(err);
      throw err;
    }
  }, [createPC]);

  // ── Helper: add ICE candidate an toàn ──
  const safeAddIce = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (!pc.remoteDescription) {
      // Chưa có remoteDescription → xếp hàng
     ("[WebRTC] ICE queued (no remoteDesc yet)");
      iceCandQueue.current.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[WebRTC] addIceCandidate err:", e);
    }
  }, []);

  // ── Drain ICE queue sau khi set remoteDescription ──
  const drainIceQueue = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = iceCandQueue.current.splice(0);
   ("[WebRTC] draining ICE queue, items:", queue.length);
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {
        console.warn("[WebRTC] drain addIce:", e);
      }
    }
  }, []);

  // ── Entry point khi CallPage mount ──
  const start = useCallback(async () => {
    const { isCaller, peerId, messageId, socket } = metaRef.current;
   ("[WebRTC] start() — isCaller:", isCaller, "peerId:", peerId);
    try {
      const pc = await initPC();
      if (isCaller) {
        if (!peerId) { console.error("[WebRTC] start: peerId empty!"); return; }
        // Delay 1s để Receiver kịp mount CallPage + đăng ký on("call:offer")
        setTimeout(async () => {
          const m = metaRef.current; // fresh
          if (!pcRef.current || pcRef.current.signalingState === "closed") return;
          try {
           ("[WebRTC] Creating offer to:", m.peerId);
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            m.socket.emit("call:offer", { to: m.peerId, offer, messageId: m.messageId });
           ("[WebRTC] Offer emitted!");
          } catch (e) { console.error("[WebRTC] createOffer err:", e); }
        }, 1000);
      }
    } catch (err) {
      console.error("[WebRTC] start err:", err);
    }
  }, [initPC]);

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket || !activeCall) return;

    const onOffer = async ({ offer }) => {
      const m = metaRef.current;
     ("[WebRTC] Received OFFER → peerId:", m.peerId);
      try {
        await initPC(); // đảm bảo PC và mic đã sẵn sàng
        const pc = pcRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await drainIceQueue(); // flush ICE candidates đang đợi
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        m.socket.emit("call:answer", { to: m.peerId, answer, messageId: m.messageId });
       ("[WebRTC] Answer emitted!");
      } catch (err) {
        console.error("[WebRTC] onOffer err:", err);
      }
    };

    const onAnswer = async ({ answer }) => {
     ("[WebRTC] Received ANSWER");
      try {
        const pc = pcRef.current;
        if (!pc) { console.error("[WebRTC] onAnswer: no PC"); return; }
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainIceQueue(); // flush ICE candidates đang đợi
      } catch (err) {
        console.error("[WebRTC] onAnswer err:", err);
      }
    };

    const onIce = ({ candidate }) => {
     ("[WebRTC] Received ICE candidate");
      safeAddIce(candidate);
    };

    socket.on("call:offer",  onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice",    onIce);

    return () => {
      socket.off("call:offer",  onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice",    onIce);
    };
  }, [socket, activeCall, initPC, safeAddIce, drainIceQueue]);

  // ── Dọn dẹp ──
  const cleanup = useCallback(() => {
   ("[WebRTC] cleanup");
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack        = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current = null;
    initDoneRef.current    = false;
    iceCandQueue.current   = [];
  }, []);

  // ── Toggle mute ──
  const setMicMuted = useCallback((muted) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, []);

  return { start, cleanup, setMicMuted };
}