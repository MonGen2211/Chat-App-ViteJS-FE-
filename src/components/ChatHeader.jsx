import React from "react";
import { X, Phone, Video } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";
import { useNavigate } from "react-router-dom";

const ChatHeader = () => {
  const {
    selectedUser,
    setSelectedUser,
    selectedGroup,
    clearSelectedGroup,
    setSelectedGroup,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const { createCall, isCalling, groupCall, incomingGroupCall, joinGroupCall } = useCallStore();
  const navigate = useNavigate();

  const isGroup = !!selectedGroup;
  if (!selectedUser && !selectedGroup) return null;

  const title = isGroup ? selectedGroup?.name : selectedUser?.fullname;

  const avatar = isGroup
    ? selectedGroup?.avatar || "/avatar.png"
    : selectedUser?.profilefic || selectedUser?.profilePic || "/avatar.png";

  const memberCount = selectedGroup?.members?.length + 1 ?? 0;

  const isOnline = !isGroup && onlineUsers.includes(selectedUser?._id);

  const subText = isGroup ? `${memberCount} members` : isOnline ? "Online" : "Offline";

  const handleClose = () => {
    setSelectedUser(null);
    setSelectedGroup(null);
    clearSelectedGroup();
  };

  // ── 1-1 Calls ──
  const handleAudioCall = () => {
    createCall({
      chatType: "direct",
      receiveId: selectedUser._id,
      callType: "audio",
    });
  };

  const handleVideoCall = () => {
    createCall({
      chatType: "direct",
      receiveId: selectedUser._id,
      callType: "video",
    });
  };

  // ── Group Audio Call ──
  const handleGroupAudioCall = async () => {
    const gId = selectedGroup._id?.toString();

    // Nếu đang trong active call của chính group này → navigate trực tiếp
    if (groupCall && groupCall.groupId?.toString() === gId) {
      navigate("/group-call");
      return;
    }

    // Nếu đang có incoming call của group này (B online thấy notification) → join
    if (incomingGroupCall && incomingGroupCall.groupId?.toString() === gId) {
      const { callId, groupName, groupAvatar, callType, messageId, initiatorInfo } = incomingGroupCall;
      joinGroupCall({
        callId,
        groupId: gId,
        groupName,
        groupAvatar,
        callType,
        messageId,
        currentParticipants: [initiatorInfo].filter(Boolean),
      });
      navigate("/group-call");
      return;
    }

    // Tạo cuộc gọi mới
    const res = await createCall({
      chatType: "group",
      groupId: selectedGroup._id,
      callType: "audio",
    });
    if (res?.msg?.call?.callId) {
      navigate("/group-call");
    }
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

        <div className="flex items-center gap-1.5">
          {/* 1-1 call buttons */}
          {!isGroup && (
            <>
              <button
                type="button"
                disabled={isCalling || !isOnline}
                className={[
                  "btn btn-ghost btn-sm btn-square",
                  !isOnline ? "btn-disabled opacity-50" : "",
                ].join(" ")}
                onClick={handleAudioCall}
                title={isOnline ? "Gọi thoại" : "User đang offline"}
              >
                <Phone className="size-5 text-white" />
              </button>

              <button
                type="button"
                disabled={isCalling || !isOnline}
                className={[
                  "btn btn-ghost btn-sm btn-square",
                  !isOnline ? "btn-disabled opacity-50" : "",
                ].join(" ")}
                onClick={handleVideoCall}
                title={isOnline ? "Gọi video" : "User đang offline"}
              >
                <Video className="size-5 text-white" />
              </button>
            </>
          )}

          {/* Group call button */}
          {isGroup && (
            <button
              type="button"
              disabled={isCalling}
              className="btn btn-ghost btn-sm btn-square"
              onClick={handleGroupAudioCall}
              title="Gọi nhóm"
            >
              <Phone className="size-5 text-white" />
            </button>
          )}

          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={handleClose} title="Đóng">
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;