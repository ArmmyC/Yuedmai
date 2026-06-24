import { Navigate, Route, Routes } from "react-router-dom";

import Index from "./pages/Index";
import KioskComplete from "./pages/KioskComplete";
import KioskIdle from "./pages/KioskIdle";
import KioskSession from "./pages/KioskSession";
import NotFound from "./pages/NotFound";
import PhoneController from "./pages/PhoneController";
import PhoneJoin from "./pages/PhoneJoin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/display" element={<KioskIdle />} />
      <Route path="/display/:roomCode" element={<KioskIdle />} />
      <Route path="/kiosk" element={<KioskIdle />} />
      <Route path="/kiosk/:roomCode" element={<KioskIdle />} />
      <Route path="/kiosk/:roomCode/session" element={<KioskSession />} />
      <Route path="/kiosk/:roomCode/complete" element={<KioskComplete />} />
      <Route path="/join/:roomCode" element={<PhoneJoin />} />
      <Route path="/controller/:roomCode" element={<PhoneController />} />
      <Route path="/phone" element={<Navigate to="/display" replace />} />
      <Route path="/phone/controller" element={<Navigate to="/display" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
