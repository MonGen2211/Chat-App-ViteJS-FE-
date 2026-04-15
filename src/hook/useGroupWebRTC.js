import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";

const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/**
 * useGroupWebRTC
 *
 * Quản lý WebRTC mesh cho cuộc gọi nhóm.
 * Mỗi peer có 1 RTCPeerConnection riêng, lưu trong peerMapRef.
 *
 * peerMapRef: Map<peerId, { pc: RTCPeerConnection, iceQueue: RTCIceCandidate[] }>
 */
export function useGroupWebRTC({ groupCall, onParticipantStream, onParticipantLeft, onParticipantJoined, onError }) {
  const peerMapRef     = useRef(new Map()); // Map<peerId, { pc, iceQueue }>
  const localStreamRef = useRef(null);

  const metaRef = useRef({});

  const socket   = useAuthStore.getState().socket;
  const authUser = useAuthStore.getState().authUser;
  const myId     = authUser?._id?.toString() ?? "";

  const groupId = groupCall?.groupId?.toString() ?? "";
  const callId  = groupCall?.callId ?? "";

  metaRef.current = { socket, myId, groupId, callId, onParticipantStream, onParticipantLeft, onParticipantJoined, onError };

  // ── Tạo PC với một peer cụ thể ──
  const createPeerPC = useCallback((peerId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const iceQueue = [];

    // Gửi ICE candidate đến peer này
    pc.onicecandidate = ({ candidate }) => {
      const { socket, groupId, callId } = metaRef.current;
      if (candidate && peerId) {
        socket.emit("call:group-ice", { to: peerId, candidate, callId, groupId });
      }
    };

    // Nhận audio/video stream từ peer
    pc.ontrack = (e) => {
      const { onParticipantStream } = metaRef.current;
      console.log(`[GroupWebRTC] ontrack from ${peerId}`, e.streams.length);
      if (e.streams?.[0]) onParticipantStream(peerId, e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[GroupWebRTC] ${peerId} connectionState:`, pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        metaRef.current.onParticipantLeft?.(peerId);
      }
    };

    peerMapRef.current.set(peerId, { pc, iceQueue });
    return { pc, iceQueue };
  }, []);

  // ── Thêm local tracks vào 1 PC ──
  const addLocalTracks = useCallback((pc) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  }, []);

  // ── Safe add ICE (queue nếu chưa có remoteDesc) ──
  const safeAddIce = useCallback(async (peerId, candidate) => {
    const peer = peerMapRef.current.get(peerId);
    if (!peer) return;
    const { pc, iceQueue } = peer;
    if (!pc.remoteDescription) {
      iceQueue.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn(`[GroupWebRTC] addIce from ${peerId}:`, e);
    }
  }, []);

  // ── Drain ICE queue sau khi set remoteDesc ──
  const drainIceQueue = useCallback(async (peerId) => {
    const peer = peerMapRef.current.get(peerId);
    if (!peer) return;
    const { pc, iceQueue } = peer;
    const items = iceQueue.splice(0);
    for (const c of items) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {
        console.warn(`[GroupWebRTC] drainIce from ${peerId}:`, e);
      }
    }
  }, []);

  // ── Entry point: join vào group call ──
  // participants: danh sách userId của những người ĐANG trong call (đã join trước)
  const joinCall = useCallback(async (participants = []) => {
    const { socket, myId, groupId, callId, onError } = metaRef.current;
    console.log("[GroupWebRTC] joinCall, participants:", participants);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Thông báo cho group room biết mình đã join
      const userInfo = {
        _id: authUser?._id,
        fullName: authUser?.fullname,
        profilePic: authUser?.profilefic,
      };
      socket.emit("call:group-join", { groupId, callId, userInfo });

      // Với mỗi người đã có trong call, ta là Offerer
      // (delay staggered để tránh đụng độ)
      for (let i = 0; i < participants.length; i++) {
        const peerId = participants[i].toString();
        if (peerId === myId) continue;
        setTimeout(async () => {
          console.log("[GroupWebRTC] creating offer to existing peer:", peerId);
          const { pc } = createPeerPC(peerId);
          addLocalTracks(pc);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const m = metaRef.current;
            // Kèm senderInfo để peer biết tên/avatar của ta
            m.socket.emit("call:group-offer", {
              to: peerId,
              offer,
              callId: m.callId,
              groupId: m.groupId,
              senderInfo: userInfo,
            });
          } catch (e) { console.error("[GroupWebRTC] offer err:", e); }
        }, i * 300);
      }
    } catch (err) {
      console.error("[GroupWebRTC] joinCall error:", err);
      onError?.(err);
    }
  }, [createPeerPC, addLocalTracks, authUser]);

  // ── Socket event handlers ──
  useEffect(() => {
    if (!socket || !groupCall) return;

    // Người mới join → ta là Offerer gửi offer cho họ
    const onGroupJoin = async ({ fromUserId, userInfo }) => {
      const { myId, groupId, callId, socket, onParticipantJoined } = metaRef.current;
      if (fromUserId === myId) return; // chính mình
      console.log("[GroupWebRTC] onGroupJoin from:", fromUserId, userInfo);

      // Thông báo UI về participant mới (để hiển thị tên/avatar)
      onParticipantJoined?.(fromUserId, userInfo ?? { _id: fromUserId });

      // Nếu đã có PC với người này thì bỏ qua (tránh duplicate)
      if (peerMapRef.current.has(fromUserId)) return;

      // Ta đang trong call → tạo offer đến người mới, kèm senderInfo của ta
      await new Promise(r => setTimeout(r, 500)); // đợi Receiver kịp mount
      const { pc } = createPeerPC(fromUserId);
      addLocalTracks(pc);
      const myUserInfo = {
        _id: authUser?._id,
        fullName: authUser?.fullname,
        profilePic: authUser?.profilefic,
      };
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:group-offer", {
          to: fromUserId,
          offer,
          callId,
          groupId,
          senderInfo: myUserInfo, // để người nhận biết tên/avatar của ta
        });
      } catch (e) { console.error("[GroupWebRTC] offer to new joiner err:", e); }
    };

    // Nhận offer → ta là Answerer
    const onGroupOffer = async ({ from, offer, senderInfo }) => {
      const { socket, groupId, callId, myId, onParticipantJoined } = metaRef.current;
      if (from === myId) return;
      console.log("[GroupWebRTC] onGroupOffer from:", from, senderInfo);

      // Nếu nhận được senderInfo từ offer, cập nhật tên/avatar ngay
      if (senderInfo) {
        onParticipantJoined?.(from, senderInfo);
      }

      let peerEntry = peerMapRef.current.get(from);
      if (!peerEntry) {
        peerEntry = createPeerPC(from);
        addLocalTracks(peerEntry.pc);
      }
      const { pc } = peerEntry;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await drainIceQueue(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:group-answer", { to: from, answer, callId, groupId });
      } catch (e) { console.error("[GroupWebRTC] onGroupOffer err:", e); }
    };

    // Nhận answer → set remote desc
    const onGroupAnswer = async ({ from, answer }) => {
      const { myId } = metaRef.current;
      if (from === myId) return;
      console.log("[GroupWebRTC] onGroupAnswer from:", from);
      const peer = peerMapRef.current.get(from);
      if (!peer) return;
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainIceQueue(from);
      } catch (e) { console.error("[GroupWebRTC] onGroupAnswer err:", e); }
    };

    // Nhận ICE candidate
    const onGroupIce = ({ from, candidate }) => {
      safeAddIce(from, candidate);
    };

    // Người rời call
    const onGroupLeave = ({ fromUserId }) => {
      const { myId, onParticipantLeft } = metaRef.current;
      if (fromUserId === myId) return;
      console.log("[GroupWebRTC] onGroupLeave:", fromUserId);
      const peer = peerMapRef.current.get(fromUserId);
      if (peer) {
        peer.pc.close();
        peerMapRef.current.delete(fromUserId);
      }
      onParticipantLeft?.(fromUserId);
    };

    socket.on("call:group-join",   onGroupJoin);
    socket.on("call:group-offer",  onGroupOffer);
    socket.on("call:group-answer", onGroupAnswer);
    socket.on("call:group-ice",    onGroupIce);
    socket.on("call:group-leave",  onGroupLeave);

    return () => {
      socket.off("call:group-join",   onGroupJoin);
      socket.off("call:group-offer",  onGroupOffer);
      socket.off("call:group-answer", onGroupAnswer);
      socket.off("call:group-ice",    onGroupIce);
      socket.off("call:group-leave",  onGroupLeave);
    };
  }, [socket, groupCall, createPeerPC, addLocalTracks, drainIceQueue, safeAddIce]);

  // ── Dọn dẹp ──
  const cleanup = useCallback(() => {
    console.log("[GroupWebRTC] cleanup");
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerMapRef.current.forEach(({ pc }) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
    });
    peerMapRef.current.clear();
  }, []);

  // ── Toggle mute ──
  const setMicMuted = useCallback((muted) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, []);

  return { joinCall, cleanup, setMicMuted };
}
