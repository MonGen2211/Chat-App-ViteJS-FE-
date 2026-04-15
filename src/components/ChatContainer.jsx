import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import { useCallStore } from "../store/useCallStore";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff } from "lucide-react";

const ChatContainer = () => {
  const {
    getMessages,
    isMessageLoading,
    selectedUser,
    messages,
    subscribeToMessages,
    unsubscribeFromMessages,
    deleteMessage,
    selectedGroup,
  } = useChatStore();
	const { createCall, isCalling, groupCall, incomingGroupCall, joinGroupCall } = useCallStore();

  const navigate = useNavigate();
  const messageEndRef = useRef();
  const [openMenuId, setOpenMenuId] = useState(null);
  const { authUser } = useAuthStore();

  // ── 1-1 Calls ──
  const handleAudioCall = () => {
    createCall({
      chatType: "direct",
      receiveId: selectedUser._id,
      callType: "audio",
    });
  };

  // ── Group Audio Call ──
  const handleGroupAudioCall = async () => {
    const gId = selectedGroup._id?.toString();

    if (groupCall && groupCall.groupId?.toString() === gId) {
      navigate("/group-call");
      return;
    }

    if (incomingGroupCall && incomingGroupCall.groupId?.toString() === gId) {
      const {
        callId,
        groupName,
        groupAvatar,
        callType,
        messageId,
        initiatorInfo,
      } = incomingGroupCall;
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

  // const [image, setImage] = useState(null);
  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedGroup?._id) {
      getMessages(selectedGroup._id);
      subscribeToMessages();
      return () => unsubscribeFromMessages();
    }

    if (!selectedUser?._id) return;

    getMessages(selectedUser._id);
    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [
    selectedUser?._id,
    selectedGroup?._id,
    getMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);
  if (isMessageLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onClick={() => setOpenMenuId(null)}
      >
        {messages.map((message, index) => {
          const isMine = message.senderId === authUser?._id;
          const isOpen = openMenuId === message._id;
          return (
            <div
              key={message._id || index}
              className={`chat ${
                message.senderId === authUser._id ? "chat-end" : "chat-start"
              }`}
              ref={index === messages.length - 1 ? messageEndRef : null}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chat-image avatar">
                <div className="w-10 rounded-full">
                  <img
                    alt="avatar"
                    src={
                      isMine
                        ? authUser?.profilefic || "/avatar.png"
                        : selectedUser?.profilefic || "/avatar.png"
                    }
                  />
                </div>
              </div>

              <div className="relative max-w-[60%]">
                <div
                  className={`flex items-end gap-2 ${
                    isMine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Bubble */}
                  <div>
                    {message.softDeletedAt !== null ? (
                      <div className="chat-bubble opacity-70 italic">
                        Tin nhắn đã được thu hồi
                      </div>
                    ) : message.type === "call" ? (
                      (() => {
                        const call = message.call || {};
                        const status = call.status; // ringing | accepted | missed | ended | rejected...
                        const isMissed =
                          status === "missed" ||
                          status === "rejected" ||
                          (status === "ringing" &&
                            call.endedAt &&
                            !call.acceptedAt); // fallback

                        const title = isMissed
                          ? "Đã bỏ lỡ cuộc gọi thoại"
                          : "Cuộc gọi thoại";
                        let sub = "";
                        if (call.acceptedAt && call.endedAt) {
                          sub = formatDuration(call.acceptedAt, call.endedAt);
                        } else if (isMissed) {
                          sub = formatHHmm(call.endedAt || message.createdAt);
                        } else if (status === "ringing") {
                          sub = "Đang gọi...";
                        } else if (message.groupId) {
                          sub = formatDuration(call.startedAt, call.endedAt);
                        } else {
                          sub = "";
                        }

                        return (
                          <div
                            className={`w-[260px] rounded-2xl p-3 ${
                              isMissed ? "bg-[#2b1b1b]" : "bg-[#1e222a]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  isMissed ? "bg-red-600/20" : "bg-white/10"
                                }`}
                              >
                                {isMissed ? (
                                  <PhoneOff className="w-5 h-5 text-red-500" />
                                ) : (
                                  <Phone className="w-5 h-5 text-white/80" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="text-white font-semibold leading-tight">
                                  {title}
                                </div>
                                {sub && (
                                  <div className="text-white/70 text-sm mt-0.5">
                                    {sub}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="mt-3 w-full rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold py-2"
                              onClick={() => {
                                // Nếu group call đang active (ringing/accepted) → join vào không tạo mới
                                if (
                                  message.chatType === "group" &&
                                  (status === "ringing" ||
                                    status === "accepted")
                                ) {
                                  joinGroupCall({
                                    callId: call.callId,
                                    groupId:
                                      message.groupId || selectedGroup?._id,
                                    groupName: selectedGroup?.name ?? "",
                                    groupAvatar: selectedGroup?.avatar ?? "",
                                    callType: call.callType || "audio",
                                    messageId: message._id,
                                    currentParticipants: [],
                                  });
                                  navigate("/group-call");
                                } else if (message.chatType === "group") {
                                  // Cuộc gọi đã kết thúc → tạo cuộc gọi mới
                                  createCall({
                                    chatType: "group",
                                    groupId:
                                      message.groupId || selectedGroup?._id,
                                    receiveId: null,
                                    callType: call.callType || "audio",
                                  });
                                } else {
                                  // direct
                                  const otherId = isMine
                                    ? message.receiveId
                                    : message.senderId;
                                  createCall({
                                    chatType: "direct",
                                    receiveId: otherId || selectedUser?._id,
                                    groupId: null,
                                    callType: call.callType || "audio",
                                  });
                                }
                              }}
                            >
                              {message.chatType === "group" &&
                              (status === "ringing" || status === "accepted")
                                ? "Tham gia cuộc gọi"
                                : "Gọi lại"}
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        {message.text && (
                          <div className="chat-bubble">{message.text}</div>
                        )}

                        {message.image && (
                          <div className="chat-bubble">
                            <img
                              src={message.image}
                              alt="image"
                              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Nút 3 chấm dạng icon tròn */}
                  <button
                    type="button"
                    className="w-9 h-9 rounded-full bg-[#0b0f2a]/70 hover:bg-[#0b0f2a]/90
                 flex items-center justify-center text-white/90 select-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((prev) =>
                        prev === message._id ? null : message._id,
                      );
                    }}
                    aria-label="Message actions"
                  >
                    <span className="text-xl leading-none">⋮</span>
                  </button>
                </div>

                {/* Menu popup */}
                {isOpen && (
                  <div
                    className={`absolute z-50 mt-2 ${
                      isMine ? "right-0" : "left-0"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ul className="menu bg-neutral text-neutral-content rounded-xl w-44 shadow-lg p-2">
                      <li>
                        <button
                          type="button"
                          className="font-semibold"
                          onClick={() => {
                            deleteMessage(message._id);
                            setOpenMenuId(null);
                          }}
                        >
                          Thu hồi
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
// helper
const formatDuration = (start, end) => {
  if (!start || !end) return "";
  const s = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} phút ${r} giây`;
};

const formatHHmm = (dateLike) => {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
