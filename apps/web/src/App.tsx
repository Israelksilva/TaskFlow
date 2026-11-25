import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { LoadingScreen } from "@/components/feedback/LoadingScreen";
import { AuthProvider } from "@/features/auth/auth-context";
import { GuestOnly, RequireAuth } from "@/features/auth/route-guards";
import { queryClient } from "@/lib/query-client";

// Code splitting: cada tela é carregada sob demanda.
const named = <T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

const AppShell = named(() => import("@/components/layout/AppShell"), "AppShell");
const AppIndex = named(() => import("@/components/layout/AppShell"), "AppIndex");
const LandingPage = lazy(() => import("@/features/marketing/LandingPage"));
const PrivacyPage = named(() => import("@/features/marketing/LegalPages"), "PrivacyPage");
const TermsPage = named(() => import("@/features/marketing/LegalPages"), "TermsPage");
const HelpPage = named(() => import("@/features/marketing/LegalPages"), "HelpPage");
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/pages/RegisterPage"));
const ForgotPasswordPage = named(() => import("@/features/auth/pages/AccountFlows"), "ForgotPasswordPage");
const ResetPasswordPage = named(() => import("@/features/auth/pages/AccountFlows"), "ResetPasswordPage");
const VerifyEmailPage = named(() => import("@/features/auth/pages/AccountFlows"), "VerifyEmailPage");
const InvitationPage = named(() => import("@/features/auth/pages/AccountFlows"), "InvitationPage");
const OnboardingPage = named(() => import("@/features/auth/pages/AccountFlows"), "OnboardingPage");
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const MyTasksPage = lazy(() => import("@/features/tasks/pages/MyTasksPage"));
const TrashPage = lazy(() => import("@/features/tasks/pages/TrashPage"));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage"));
const ProjectPage = lazy(() => import("@/features/projects/ProjectPage"));
const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage"));
const TimePage = lazy(() => import("@/features/time/TimePage"));
const TeamPage = lazy(() => import("@/features/workspaces/pages/TeamPage"));
const WorkspaceSettingsPage = lazy(() => import("@/features/workspaces/pages/WorkspaceSettingsPage"));
const PlansPage = lazy(() => import("@/features/billing/PlansPage"));
const NotificationsPage = lazy(() => import("@/features/notifications/NotificationsPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {/* HashRouter: compatível com hospedagem estática (GitHub Pages). */}
          <HashRouter>
            <AuthProvider>
              <ErrorBoundary>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    {/* Públicas */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/privacidade" element={<PrivacyPage />} />
                    <Route path="/termos" element={<TermsPage />} />
                    <Route path="/ajuda" element={<HelpPage />} />
                    <Route path="/verificar-email" element={<VerifyEmailPage />} />
                    <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                    <Route path="/convite" element={<InvitationPage />} />
                    <Route element={<GuestOnly />}>
                      <Route path="/entrar" element={<LoginPage />} />
                      <Route path="/cadastro" element={<RegisterPage />} />
                      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
                    </Route>

                    {/* Autenticadas */}
                    <Route element={<RequireAuth />}>
                      <Route path="/boas-vindas" element={<OnboardingPage />} />
                      <Route path="/app" element={<AppShell />}>
                        <Route index element={<AppIndex />} />
                        <Route path="notificacoes" element={<NotificationsPage />} />
                        <Route path="configuracoes" element={<SettingsPage />} />
                        <Route path="configuracoes/:secao" element={<SettingsPage />} />
                        <Route path="w/:workspaceId">
                          <Route index element={<DashboardPage />} />
                          <Route path="minhas-tarefas" element={<MyTasksPage />} />
                          <Route path="projetos" element={<ProjectsPage />} />
                          <Route path="projetos/:projectId" element={<ProjectPage />} />
                          <Route path="calendario" element={<CalendarPage />} />
                          <Route path="tempo" element={<TimePage />} />
                          <Route path="equipe" element={<TeamPage />} />
                          <Route path="lixeira" element={<TrashPage />} />
                          <Route path="ajustes" element={<WorkspaceSettingsPage />} />
                          <Route path="planos" element={<PlansPage />} />
                        </Route>
                      </Route>
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </AuthProvider>
          </HashRouter>
          <Toaster richColors closeButton position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
