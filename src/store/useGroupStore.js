// src/store/useGroupStore.js
import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useGroupStore = create((set, get) => ({
  groups: [],
  isGroupsLoading: false,
  isCreatingGroup: false,

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/group");
      set({ groups: res.data?.data || [] });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Get groups failed");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async ({ name, avatar = "", member_ids = [] }) => {
    set({ isCreatingGroup: true });
    try {
      const res = await axiosInstance.post("/group", {
        name,
        avatar,
        member_ids,
      });

      const newGroup = res.data?.data;
      if (!newGroup) {
        toast.error("Create group failed");
        return null;
      }

      set({ groups: [newGroup, ...get().groups] });
      return newGroup;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Create group failed");
      return null;
    } finally {
      set({ isCreatingGroup: false });
    }
  },

  subscribeToGroups: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newGroup");
    socket.on("newGroup", (newGroup) => {
      const exists = get().groups.some((g) => g._id === newGroup._id);
      if (exists) return;
      set({ groups: [newGroup, ...get().groups] });
    });
  },

  unsubscribeFromGroups: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newGroup");
  },

}));
