import React, { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import SidbarSkeleton from "./skeletons/SidbarSkeleton";
import {
  Users,
  UserPlus,
  X,
  Search,
  MessageSquare,
  UsersRound,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

const Sidebar = () => {
  const {
    getUsers,
    isUserLoading,
    setSelectedUser,
    users,
    selectedUser,
    setSelectedGroup,
    selectedGroup,
  } = useChatStore();

  const {
    getGroups,
    groups,
    isGroupsLoading,
    createGroup,
    subscribeToGroups,
    unsubscribeFromGroups,
  } = useGroupStore();

  const { onlineUsers, authUser } = useAuthStore();

  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [activeTab, setActiveTab] = useState("direct");

  const [openCreateGroup, setOpenCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  const fillteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  const selectableUsers = useMemo(() => {
    const base = users.filter((u) => u._id !== authUser?._id);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((u) => (u.fullname || "").toLowerCase().includes(q));
  }, [users, authUser?._id, search]);

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const closeModal = () => {
    setOpenCreateGroup(false);
    setGroupName("");
    setSearch("");
    setSelectedMemberIds([]);
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    if (!name) return;

    const newGroup = await createGroup({
      name,
      avatar: "",
      member_ids: selectedMemberIds,
    });

    if (newGroup) {
      await getGroups();

      setSelectedGroup(newGroup);
      setActiveTab("group");
      closeModal();
    }
  };

	console.log(groups)

  useEffect(() => {
    getUsers();
    getGroups();
    subscribeToGroups();
  }, [getUsers, getGroups, subscribeToGroups, unsubscribeFromGroups]);

  if (isUserLoading) return <SidbarSkeleton />;

  return (
    <>
      <aside className="h-full overflow-y-auto w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
        <div className="border-b border-base-300 w-full p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="size-6" />
              <span className="font-medium hidden lg:block">Contacts</span>
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpenCreateGroup(true)}
              title="Tạo nhóm"
            >
              <UserPlus className="size-5" />
              <span className="hidden lg:inline">Tạo nhóm</span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center lg:justify-start gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={[
                "h-11 w-11 rounded-2xl flex items-center justify-center transition-colors",
                activeTab === "direct"
                  ? "bg-primary text-primary-content"
                  : "bg-base-200 hover:bg-base-300 text-base-content/80",
              ].join(" ")}
              title="Tin nhắn cá nhân"
            >
              <MessageSquare className="size-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("group")}
              className={[
                "h-11 w-11 rounded-2xl flex items-center justify-center transition-colors",
                activeTab === "group"
                  ? "bg-primary text-primary-content"
                  : "bg-base-200 hover:bg-base-300 text-base-content/80",
              ].join(" ")}
              title="Nhóm"
            >
              <UsersRound className="size-5" />
            </button>
          </div>

          {activeTab === "direct" && (
            <div className="mt-3 hidden lg:flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlineOnly}
                  onChange={(e) => setShowOnlineOnly(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                <span className="text-sm">Show online only</span>
              </label>
              <span className="text-xs text-zinc-500">
                ({onlineUsers.length - 1} online)
              </span>
            </div>
          )}
        </div>

        {activeTab === "direct" ? (
          <>
            {fillteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => {
                  setSelectedGroup(null);
                  setSelectedUser(user);
                }}
                className={`
                  w-full p-3 flex items-center gap-3
                  hover:bg-base-300 transition-colors
                  ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                `}
              >
                <div className="relative mx-auto lg:mx-0">
                  <img
                    src={user.profilefic || "/avatar.png"}
                    alt={user.fullname}
                    className="size-12 object-cover rounded-full"
                  />
                  {onlineUsers.includes(user._id) && (
                    <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-zinc-900" />
                  )}
                </div>

                <div className="hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">{user.fullname}</div>
                  <div className="text-sm text-zinc-400">
                    {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                  </div>
                </div>
              </button>
            ))}

            {fillteredUsers.length === 0 && (
              <div className="text-center text-zinc-500 py-4">
                No online users
              </div>
            )}
          </>
        ) : (
          <>
            {isGroupsLoading ? (
              <div className="p-4 text-center opacity-70">
                Loading groups...
              </div>
            ) : (
              <>
                {groups.map((g) => (
                  <button
                    key={g._id}
                    onClick={() => {
                      setSelectedGroup(g);
                    }}
                    className={`
                      w-full p-3 flex items-center gap-3
                      hover:bg-base-300 transition-colors
                      ${selectedGroup?._id === g._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                    `}
                  >
                    <div className="relative mx-auto lg:mx-0">
                      <img
                        src={g.avatar || "/avatar.png"}
                        alt={g.name}
                        className="size-12 object-cover rounded-full"
                      />
                    </div>

                    <div className="hidden lg:block text-left min-w-0">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-sm text-zinc-400">
                        {g.members?.length + 1 || 0} members
                      </div>
                    </div>
                  </button>
                ))}

                {groups.length === 0 && (
                  <div className="p-4 text-center opacity-70">
                    No groups yet
                  </div>
                )}
              </>
            )}
          </>
        )}
      </aside>

      {openCreateGroup && (
        <div className="fixed inset-0 z-[999]">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-base-300 bg-base-100 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
              <h3 className="text-base font-semibold">Tạo nhóm</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-base-200 flex items-center justify-center">
                  <UserPlus className="size-5" />
                </div>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nhập tên nhóm..."
                  className="input input-bordered w-full"
                />
              </div>

              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-70" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nhập tên để tìm user..."
                  className="input input-bordered w-full pl-9"
                />
              </div>

              <div className="text-sm opacity-70">
                Đã chọn: {selectedMemberIds.length}
              </div>

              <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-base-300">
                {selectableUsers.map((u) => {
                  const checked = selectedMemberIds.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => toggleMember(u._id)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-200 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="checkbox checkbox-sm"
                      />
                      <img
                        src={u.profilefic || "/avatar.png"}
                        alt={u.fullname}
                        className="size-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 text-left">
                        <div className="font-medium truncate">{u.fullname}</div>
                        <div className="text-xs opacity-60">
                          {onlineUsers.includes(u._id) ? "Online" : "Offline"}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {selectableUsers.length === 0 && (
                  <div className="p-4 text-center opacity-60">
                    Không có user
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-base-300">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                Huỷ
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={selectedMemberIds.length === 0 || !groupName.trim()}
                onClick={handleCreateGroup}
              >
                Tạo nhóm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
