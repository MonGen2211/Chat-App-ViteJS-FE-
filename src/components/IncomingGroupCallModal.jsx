import React from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../store/useCallStore";
import { useAuthStore } from "../store/useAuthStore";

export default function IncomingGroupCallModal() {
  const { incomingGroupCall, clearIncomingGroupCall, setGroupCall } = useCallStore();
  const { authUser } = useAuthStore();
  const navigate = useNavigate();

  if (!incomingGroupCall) return null;

  const { messageId, callId, groupId, groupName, groupAvatar, initiatorInfo, callType } = incomingGroupCall;

  const handleAccept = () => {
    // Set groupCall state — những người đã trong call = chỉ initiator (caller)
    setGroupCall({
      callId,
      groupId,
      groupName,
      groupAvatar,
      callType,
      messageId: messageId?.toString(),
      currentParticipants: [initiatorInfo].filter(Boolean),
    });
    clearIncomingGroupCall();
    navigate("/group-call");
  };

  const handleDecline = () => {
    clearIncomingGroupCall();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100">
        <div className="flex items-center gap-4">
          <div className="avatar">
            <div className="w-14 rounded-full">
              <img src={groupAvatar || "/avatar.png"} alt={groupName} />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-lg">Cuộc gọi nhóm đến</h3>
            <p className="text-sm text-base-content/70 font-medium">{groupName}</p>
            <p className="text-xs text-base-content/50">
              {initiatorInfo?.fullName || "Someone"} đang gọi
            </p>
            <p className="text-sm text-base-content/70 capitalize mt-1">
              {callType === "video" ? "📹 Video call" : "🎙 Voice call"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button className="btn btn-error btn-outline" onClick={handleDecline}>
            <PhoneOff className="w-4 h-4" />
            Từ chối
          </button>

          <button className="btn btn-success" onClick={handleAccept}>
            <Phone className="w-4 h-4" />
            Chấp nhận
          </button>
        </div>
      </div>

      <div className="modal-backdrop" onClick={handleDecline} />
    </div>
  );
}
