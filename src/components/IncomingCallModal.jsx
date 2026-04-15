import React from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallStore } from "../store/useCallStore";

export default function IncomingCallModal() {
  const { incomingCall, clearIncomingCall, respondCall, setActiveCall } = useCallStore();
  const navigate = useNavigate();

  if (!incomingCall) return null;

  const { messageId, fromUserId, callType, callerInfo } = incomingCall;

  const handleAccept = async () => {
    const res = await respondCall({ messageId, action: "accept" });
    if (!res || !res.msg) return;

    // Sử dụng nguyên vẹn payload từ backend trả về (đã có đủ caller, receiver, senderId, v.v.)
    setActiveCall(res.msg);
    clearIncomingCall();
    navigate("/call");
  };

  const handleReject = async () => {
    await respondCall({ messageId, action: "reject" });
    clearIncomingCall();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box bg-base-100">
        <div className="flex items-center gap-4">
          <div className="avatar">
            <div className="w-14 rounded-full">
              <img
                src={callerInfo?.profilePic || "/avatar.png"}
                alt="caller"
              />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-lg">Cuộc gọi đến</h3>
            <p className="text-sm text-base-content/70 font-medium">
              {callerInfo?.fullName || fromUserId}
            </p>
            <p className="text-sm text-base-content/70 capitalize">
              {callType === "video" ? "📹 Video call" : "🎙 Voice call"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button className="btn btn-error btn-outline" onClick={handleReject}>
            <PhoneOff className="w-4 h-4" />
            Từ chối
          </button>

          <button className="btn btn-success" onClick={handleAccept}>
            <Phone className="w-4 h-4" />
            Chấp nhận
          </button>
        </div>
      </div>

      <div className="modal-backdrop" onClick={handleReject} />
    </div>
  );
}