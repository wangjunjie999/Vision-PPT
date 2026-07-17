import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { HardwareProvider } from "@/contexts/HardwareContext";
import { GuideProvider } from "@/contexts/GuideContext";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { WelcomeGuide } from "@/components/guide";
import { CommandPalette } from "@/components/CommandPalette";
import { supabaseRuntimeConfig } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
          <span className="text-sm text-muted-foreground">加载中...</span>
        </motion.div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const transitionConfig = {
  duration: 0.25,
};

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/auth" 
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionConfig}
              className="h-full"
            >
              <Auth />
            </motion.div>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transitionConfig}
                className="h-full"
              >
                <Index />
              </motion.div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="*" 
          element={
            <motion.div
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transitionConfig}
              className="h-full"
            >
              <NotFound />
            </motion.div>
          } 
        />
      </Routes>
    </AnimatePresence>
  );
}

function SupabaseConfigErrorPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="text-sm font-semibold text-cyan-300">启动配置缺失</div>
        <h1 className="mt-2 text-2xl font-bold">Supabase 配置缺失</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          当前预览环境没有拿到 Supabase 前端变量，应用已停止启动以避免白屏。请在 Lovable Cloud 的 Secrets 中补齐变量后重新预览。
        </p>

        <div className="mt-5 rounded-md border border-slate-700 bg-slate-950 p-4">
          <div className="text-sm font-semibold text-slate-200">缺失变量</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {supabaseRuntimeConfig.missingEnvVars.map((name) => (
              <li key={name}>
                <code className="rounded bg-slate-800 px-2 py-1 text-cyan-200">{name}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 rounded-md border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
          <div className="font-semibold text-slate-200">Lovable Secrets 建议值</div>
          <code className="mt-2 block whitespace-pre-wrap rounded bg-slate-800 p-3 text-cyan-200">
            VITE_SUPABASE_URL=https://yxjhungswhwahnbhahaq.supabase.co{"\n"}
            VITE_SUPABASE_PROJECT_ID=yxjhungswhwahnbhahaq{"\n"}
            VITE_SUPABASE_PUBLISHABLE_KEY=&lt;Supabase anon/publishable key&gt;
          </code>
        </div>
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary 
    fallbackTitle="应用加载失败"
    onReset={() => window.location.reload()}
  >
    {supabaseRuntimeConfig.isConfigured ? (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <AuthProvider>
              <DataProvider>
                <HardwareProvider>
                  <GuideProvider>
                    <Toaster />
                    <Sonner />
                    <WelcomeGuide />
                    <CommandPalette />
                    <BrowserRouter>
                      <ErrorBoundary 
                        fallbackTitle="页面加载失败"
                        onReset={() => window.location.reload()}
                      >
                        <AnimatedRoutes />
                      </ErrorBoundary>
                    </BrowserRouter>
                  </GuideProvider>
                </HardwareProvider>
              </DataProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ) : (
      <SupabaseConfigErrorPage />
    )}
  </ErrorBoundary>
);

export default App;
