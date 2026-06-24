import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import KioskIdle from "./pages/KioskIdle.tsx";
import KioskSession from "./pages/KioskSession.tsx";
import KioskComplete from "./pages/KioskComplete.tsx";
import PhoneJoin from "./pages/PhoneJoin.tsx";
import PhoneController from "./pages/PhoneController.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/kiosk" element={<KioskIdle />} />
          <Route path="/kiosk/session" element={<KioskSession />} />
          <Route path="/kiosk/complete" element={<KioskComplete />} />
          <Route path="/phone" element={<PhoneJoin />} />
          <Route path="/phone/controller" element={<PhoneController />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
