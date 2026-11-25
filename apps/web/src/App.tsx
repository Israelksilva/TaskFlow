import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingScreen } from "@/components/feedback/LoadingScreen";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/features/auth/auth-context";
import { GuestOnly, RequireAuth } from "@/features/auth/route-guards";
import { queryClient } from "@/lib/query-client";

const TasksPage = lazy(() => import("@/features/tasks/pages/TasksPage"));
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/pages/RegisterPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const DesignSystemPage = lazy(() => import("@/pages/DesignSystemPage"));

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* HashRouter: compatível com hospedagem estática (GitHub Pages). */}
          <HashRouter>
            <AuthProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route element={<RequireAuth />}>
                    <Route element={<AppShell />}>
                      <Route path="/" element={<TasksPage />} />
                      <Route path="/design-system" element={<DesignSystemPage />} />
                    </Route>
                  </Route>
                  <Route element={<GuestOnly />}>
                    <Route path="/entrar" element={<LoginPage />} />
                    <Route path="/cadastro" element={<RegisterPage />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </HashRouter>
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
