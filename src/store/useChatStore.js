import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],

  selectedUser: null,
  selectedGroup: null,

  isUserLoading: false,
  isMessagesLoading: false,
  getUsers: async () => {
    set({ isUserLoading: true });
    try {
      const res = await axiosInstance.get("/message/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUserLoading: false });
    }
  },
  getMessages: async (userId) => {
    const { selectedUser, selectedGroup } = get();
    const id = selectedGroup?._id || selectedUser?._id;
    if (!id) return;
    set({ isMessagesLoading: true });
    try {
      // chat-app-be-js-production.up.railway.app/api/message/67e13197f59bce1373de508a
      const url = selectedGroup?._id ? `/group/${id}` : `/message/${id}`;
      const res = await axiosInstance.get(url);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, selectedGroup, messages } = get();

    try {
      const url = selectedGroup?._id
        ? `/group/sendMessage/${selectedGroup?._id}`
        : `/message/sendMessage/${selectedUser._id}`;

      const res = await axiosInstance.post(url, messageData);
      set({ messages: [...messages, res.data.newMessage] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },
  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/message/delete/${messageId}`);

      const data = res.data?.data;

      const updatedMessageId = data?.messageId || data?._id || messageId;
      const softDeletedAt = data?.softDeletedAt || new Date().toISOString();

      set({
        messages: get().messages.map((m) =>
          m._id === updatedMessageId ? { ...m, softDeletedAt } : m,
        ),
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Recall message failed");
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, selectedGroup } = get();
      let ok = false;
      if (selectedGroup?._id) {
        ok = newMessage.groupId === selectedGroup._id;
      } else if (selectedUser?._id) {
        ok =
          newMessage.senderId === selectedUser._id ||
          newMessage.receiverId === selectedUser._id;
      }

      if (!ok) return;
      set({ messages: [...get().messages, newMessage] });
    });

    socket.on("deleteMessage", (payload) => {
      const messageId = payload?.messageId || payload?._id;
      const softDeletedAt = payload?.softDeletedAt;

      if (!messageId) return;

      set({
        messages: get().messages.map((m) =>
          m._id === messageId
            ? { ...m, softDeletedAt: softDeletedAt || new Date().toISOString() }
            : m,
        ),
      });
    });
  },	
  unsubscribeFromMessages: () => {
    {
      const socket = useAuthStore.getState().socket;
      socket.off("newMessage");
      socket.off("deleteMessage");
    }
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
  setSelectedGroup: (selectedGroup) => {
    const socket = useAuthStore.getState().socket;
    const { selectedGroup: prevGroup } = get();

    const join = () => {
      if (prevGroup?._id) socket?.emit("leaveGroup", prevGroup._id);
      if (selectedGroup?._id) socket?.emit("joinGroup", selectedGroup._id);
    };

    if (socket?.connected) join();
    else socket?.once("connect", join);

    set({ selectedGroup });
  },
}));
