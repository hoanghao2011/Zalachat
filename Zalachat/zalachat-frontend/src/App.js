import React from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext"; // Import ThemeProvider từ ThemeContext

// Import các component
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import OTPConfirm from "./components/OTPConfirm";
import MainTabs from "./components/MainTabs";

function App() {
  return (
    <ThemeProvider> {/* Bọc toàn bộ ứng dụng trong ThemeProvider để sử dụng chế độ sáng/tối */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/otp-confirm" element={<OTPConfirm />} />
        <Route path="/app/*" element={<MainTabs />} /> {/* Đảm bảo rằng MainTabs có thể xử lý các route con */}
        <Route path="/" element={<Login />} /> {/* Route mặc định */}
      </Routes>
    </ThemeProvider>
  );
}

export default App;
