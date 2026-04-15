import React, { useEffect } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingPage from "./pages/SettingPage";
import ProfilePage from "./pages/ProfilePage";
import CallPage from "./pages/CallPage";
import GroupCallPage from "./pages/GroupCallPage";

import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { useThemeStore } from "./store/useThemeStore";
import { useAuthStore } from "./store/useAuthStore";
import IncomingCallModal from "./components/IncomingCallModal";
import IncomingGroupCallModal from "./components/IncomingGroupCallModal";
import { useCallStore } from "./store/useCallStore";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const { activeCall, groupCall } = useCallStore();
  const navigate = useNavigate(); 
  const location = useLocation(); 

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authUser) return;
    console.log(
      "Subscribing to calls, socket:",
      useAuthStore.getState().socket?.id,
    );
    useCallStore.getState().subscribeToCalls();
    return () => useCallStore.getState().unsubscribeFromCalls();
  }, [authUser]);

  // Navigate to 1-1 call page
  useEffect(() => {
    if (activeCall) navigate("/call");
  }, [activeCall]);

  // Navigate to group call page
  useEffect(() => {
    if (groupCall) navigate("/group-call");
  }, [groupCall]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  const isCallPage = location.pathname === "/call" || location.pathname === "/group-call";

  return (
    <div data-theme={theme}>
      {!isCallPage && <Navbar />}
      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={authUser ? <SettingPage /> : <Navigate to="/login" />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path="/call" element={authUser ? <CallPage /> : <Navigate to="/login" />} />
        <Route path="/group-call" element={authUser ? <GroupCallPage /> : <Navigate to="/login" />} />
      </Routes>

      <IncomingCallModal />
      <IncomingGroupCallModal />
      <Toaster />
    </div>
  );
};

export default App;