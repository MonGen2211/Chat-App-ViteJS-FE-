import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

export const useCallStore = create((set, get) => ({
  // ── 1-1 call ──
  isCalling: false,
  incomingCall: null,
  activeCall: null,

  // ── Group call ──
  groupCall: null,
  incomingGroupCall: null,

  // ── 1-1 Actions ──
  createCall: async ({
    chatType = "direct",
    receiveId,
    groupId,
    callType = "audio",
  }) => {
    set({ isCalling: true });
    try {
      const res = await axiosInstance.post("/call", {
        chatType,
        receiveId,
        groupId,
        callType,
      });
      const newMsg = res.data?.msg;
      if (newMsg?._id) {
        const { messages } = useChatStore.getState();
        useChatStore.setState({ messages: [...messages, newMsg] });
      }

      // Nếu là group call → set groupCall state ngay cho Caller
      if (chatType === "group" && newMsg) {
        const authUser = useAuthStore.getState().authUser;
        set({
          groupCall: {
            callId: newMsg.call?.callId,
            groupId: newMsg.groupId?.toString() ?? groupId,
            groupName: res.data?.groupName ?? "",
            groupAvatar: res.data?.groupAvatar ?? "",
            callType,
            messageId: newMsg._id?.toString(),
            currentParticipants: [], // Caller đi trước, chưa có ai khác
          },
        });
      }

      return res.data;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Create call failed");
      return null;
    } finally {
      set({ isCalling: false });
    }
  },

  respondCall: async ({ messageId, action }) => {
    try {
      const res = await axiosInstance.post("/call/respond", { messageId, action });
      return res.data;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Respond call failed");
      return null;
    }
  },

  endCall: async ({ messageId }) => {
    try {
      const res = await axiosInstance.post("/call/endCall", { messageId });
      return res.data;
    } catch (error) {
      toast.error(error?.response?.data?.message || "End call failed");
      return null;
    }
  },

  setIncomingCall: (payload) => set({ incomingCall: payload }),
  clearIncomingCall: () => set({ incomingCall: null }),

  setActiveCall: (payload) => set({ activeCall: payload }),
  endActiveCall: () => set({ activeCall: null, isCalling: false }),

  // ── Group call actions ──
  setGroupCall: (payload) => set({ groupCall: payload }),
  clearGroupCall: () => set({ groupCall: null }),

  setIncomingGroupCall: (payload) => set({ incomingGroupCall: payload }),
  clearIncomingGroupCall: () => set({ incomingGroupCall: null }),

  leaveGroupCallAction: ({ callId, groupId }) => {
    // Emit trực tiếp qua socket để backend forward đúng sender (socket.to)
    const socket = useAuthStore.getState().socket;
    if (socket && callId && groupId) {
      socket.emit("call:group-leave", { callId, groupId: groupId.toString() });
    }
    set({ groupCall: null });
  },

  // Late joiner join vào cuộc gọi đang có (không tạo call mới)
  joinGroupCall: ({ callId, groupId, groupName, groupAvatar, callType, messageId, currentParticipants = [] }) => {
    set({
      groupCall: {
        callId,
        groupId: groupId?.toString(),
        groupName: groupName ?? "",
        groupAvatar: groupAvatar ?? "",
        callType: callType ?? "audio",
        messageId: messageId?.toString(),
        currentParticipants,
      },
    });
  },

  subscribeToCalls: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("call:incoming");
    socket.off("call:response");
    socket.off("call:status");
    socket.off("call:group-incoming");

    // ── 1-1 ──
    socket.on("call:incoming", (payload) => {
      console.log("[socket] call:incoming =>", payload);
      set({ incomingCall: payload });
      toast(`📞 Incoming ${payload?.callType || "audio"} call`);
    });

    socket.on("call:response", (payload) => {
      console.log("[socket] call:response =>", payload);

      if (payload.status === "accepted") {
        // Luôn cập nhật activeCall để đảm bảo cả Caller lẫn Receiver đều có đủ dữ liệu
        set({ activeCall: payload, incomingCall: null });
      }

      if (payload.status === "rejected") {
        const { incomingCall, activeCall } = get();
        if (incomingCall?.messageId === payload.messageId) {
          set({ incomingCall: null });
          toast("Cuộc gọi bị từ chối");
        }
        if (activeCall?.messageId === payload.messageId) {
          set({ activeCall: null });
        }
      }
    });

    socket.on("call:status", (payload) => {
      console.log("[socket] call:status =>", payload);
      const { incomingCall, activeCall } = get();

      if (payload.status === "missed") {
        if (incomingCall?.messageId === payload.messageId) {
          set({ incomingCall: null });
          toast("Cuộc gọi nhỡ");
        }
      }

      if (payload.status === "ended") {
        if (activeCall?.messageId === payload.messageId) {
          set({ activeCall: null, isCalling: false });
          toast("Cuộc gọi đã kết thúc");
        }
      }
    });

    // ── Group ──
    socket.on("call:group-incoming", (payload) => {
      console.log("[socket] call:group-incoming =>", payload);
      set({ incomingGroupCall: payload });
      toast(`📞 Cuộc gọi nhóm từ ${payload?.groupName || "Group"}`);
    });

    // Người khác join group call → cập nhật currentParticipants
    socket.on("call:group-join", (payload) => {
      console.log("[socket] call:group-join =>", payload);
      const { groupCall } = get();
      if (!groupCall || groupCall.callId !== payload.callId) return;
      const { fromUserId, userInfo } = payload;
      set((state) => {
        const existing = state.groupCall.currentParticipants ?? [];
        if (existing.find((p) => p._id?.toString() === fromUserId)) return {};
        return {
          groupCall: {
            ...state.groupCall,
            currentParticipants: [...existing, userInfo ?? { _id: fromUserId }],
          },
        };
      });
    });

    // Người khác rời group call → chỉ update danh sách, KHÔNG tự clear groupCall
    // Người dùng tự leave bằng nút Leave (leaveGroupCallAction)
    socket.on("call:group-leave", (payload) => {
      console.log("[socket] call:group-leave =>", payload);
      const { groupCall } = get();
      if (!groupCall || groupCall.callId !== payload.callId) return;
      const { fromUserId } = payload;
      set((state) => {
        const remaining = (state.groupCall.currentParticipants ?? []).filter(
          (p) => p._id?.toString() !== fromUserId
        );
        return {
          groupCall: {
            ...state.groupCall,
            currentParticipants: remaining,
          },
        };
      });
    });

    // Server thông báo cuộc gọi đã kết thúc (tất cả đã rời) → cập nhật message bubble
    socket.on("call:group-ended", (payload) => {
      console.log("[socket] call:group-ended =>", payload);
      const { callId } = payload;
      // Cập nhật message trong chat: đổi status sang "ended"
      const messages = useChatStore.getState().messages;
      useChatStore.setState({
        messages: messages.map((m) =>
          m.type === "call" && m.call?.callId === callId
            ? { ...m, call: { ...m.call, status: "ended", endedAt: new Date().toISOString() } }
            : m
        ),
      });
    });
  },

  unsubscribeFromCalls: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("call:incoming");
    socket.off("call:response");
    socket.off("call:status");
    socket.off("call:group-incoming");
    socket.off("call:group-join");
    socket.off("call:group-leave");
    socket.off("call:group-ended");
  },
}));