import React from "react";
import { X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, selectedGroup, clearSelectedGroup, setSelectedGroup } = useChatStore();
  const { onlineUsers } = useAuthStore();

  const isGroup = !!selectedGroup;

  if (!selectedUser && !selectedGroup) return null;

  const title = isGroup ? selectedGroup?.name : selectedUser?.fullname;

  const avatar = isGroup
    ? selectedGroup?.avatar || "/avatar.png"
    : selectedUser?.profilefic || selectedUser?.profilePic || "/avatar.png";
  const memberCount = selectedGroup?.members?.length + 1 ?? 0;

  const subText = isGroup
    ? `${memberCount} members`
    : onlineUsers.includes(selectedUser?._id)
      ? "Online"
      : "Offline";

  const handleClose = () => {
    setSelectedUser(null);
		setSelectedGroup(null)
    clearSelectedGroup();
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={avatar} alt={title || "chat"} />
            </div>
          </div>

          <div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-base-content/70">{subText}</p>
          </div>
        </div>

        <button onClick={handleClose}>
          <X />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
