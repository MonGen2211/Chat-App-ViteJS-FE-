import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";

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

  const messageEndRef = useRef();
  const [openMenuId, setOpenMenuId] = useState(null);
  const { authUser } = useAuthStore();

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
	};

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
                message.senderId === authUser._id
                  ? "chat-end"
                  : "chat-start"
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
