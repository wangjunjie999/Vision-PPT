import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { z } from 'zod';

const ParticleBackground = lazy(() => import('@/components/effects/ParticleBackground').then(m => ({ default: m.ParticleBackground })));
import { motion, AnimatePresence } from 'framer-motion';

const authSchema = z.object({
  username: z.string().trim().min(2, { message: '账号至少需要2个字符' }).max(100, { message: '账号最多100个字符' }).regex(/^[a-zA-Z0-9_\u4e00-\u9fa5@.\-+]+$/, { message: '账号只能包含字母、数字、下划线、中文或邮箱格式' }),
  password: z.string().min(6, { message: '密码至少需要6个字符' }),
  displayName: z.string().trim().max(50, { message: '显示名称最多50个字符' }).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const { user, signUp, signIn } = useAuth();
  const { toast } = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    if (user) {
      navigate(nextPath, { replace: true });
    }
  }, [user, navigate, nextPath]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ username, password });
    if (!validation.success) {
      toast({
        title: '验证失败',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);

    if (error) {
      let message = '登录失败，请重试';
      if (error.message.includes('Invalid login credentials')) {
        message = '邮箱或密码错误';
      }
      toast({
        title: '登录失败',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: '登录成功',
        description: '欢迎回来！',
      });
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = authSchema.safeParse({ username, password, displayName });
    if (!validation.success) {
      toast({
        title: '验证失败',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(username, password, displayName || undefined);
    setLoading(false);

    if (error) {
      let message = '注册失败，请重试';
      if (error.message.includes('User already registered')) {
        message = '该邮箱已被注册';
      }
      toast({
        title: '注册失败',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: '注册成功',
        description: '欢迎加入！',
      });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(235,25%,9%)] p-4 relative overflow-hidden">
      <Helmet>
        <title>登录 / 注册 - 视觉检测配置系统</title>
        <meta name="description" content="登录视觉检测配置系统，搭建工业相机方案、管理工位与硬件库，并生成可交付的检测方案 PPT。" />
        <link rel="canonical" href="/auth" />
        <meta property="og:title" content="登录 / 注册 - 视觉检测配置系统" />
        <meta property="og:description" content="登录后即可创建工业视觉检测项目、配置工位与硬件，并一键导出方案报告。" />
        <meta property="og:url" content="/auth" />
      </Helmet>
      {/* Systematic Cartography grid background */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(hsl(235 22% 14%) 1px, transparent 1px),
          linear-gradient(90deg, hsl(235 22% 14%) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />
      {/* Subtle radial glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[hsl(187,82%,37%)] rounded-full blur-[200px] opacity-[0.06]" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[hsl(220,75%,48%)] rounded-full blur-[120px] opacity-[0.08]" />
      </div>

      {/* Particle Background */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <ParticleBackground particleCount={100} interactive />
        </Suspense>
      </div>
      
      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Glass Card */}
        <div className="relative backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
          {/* Precision top line — cyan accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(187,82%,37%)] to-transparent opacity-60" />
          <div className="absolute top-[1px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[hsl(220,75%,48%)] to-transparent opacity-30" />
          
          {/* Header */}
          <div className="text-center pt-10 pb-6 px-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center h-20 w-auto rounded-2xl overflow-hidden shadow-lg shadow-primary/30 mb-6"
            >
              <img src="/ppt-covers/tech-shine-logo.png" alt="德星云" className="w-full h-full object-contain" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              视觉检测配置系统
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/60 text-sm"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              智能视觉检测 · 精准配置管理
            </motion.p>
          </div>

          {/* Tab Switcher */}
          <div className="px-8 mb-6">
            <div className="relative flex bg-white/[0.03] rounded-lg p-1 border border-white/[0.06]">
              <motion.div
                className="absolute top-1 bottom-1 rounded-md bg-gradient-to-r from-[hsl(220,75%,48%)] to-[hsl(187,82%,37%)] shadow-lg"
                initial={false}
                animate={{
                  left: activeTab === 'signin' ? '4px' : '50%',
                  width: 'calc(50% - 8px)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
              <button
                onClick={() => setActiveTab('signin')}
                className={`relative z-10 flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'signin' ? 'text-white' : 'text-white/50 hover:text-white/70'
                }`}
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                登录
              </button>
              <button
                onClick={() => setActiveTab('signup')}
                className={`relative z-10 flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'signup' ? 'text-white' : 'text-white/50 hover:text-white/70'
                }`}
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                注册
              </button>
            </div>
          </div>

          {/* Forms */}
          <div className="px-8 pb-10">
            <AnimatePresence mode="wait">
              {activeTab === 'signin' ? (
                <motion.form
                  key="signin"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSignIn}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="signin-username" className="text-white/70 text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      账号
                    </Label>
                    <div className="relative group">
                      <Input
                        id="signin-username"
                        type="text"
                        placeholder="请输入账号"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-blue-600/20 opacity-0 group-focus-within:opacity-100 -z-10 blur-xl transition-opacity" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-white/70 text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      密码
                    </Label>
                    <div className="relative group">
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-primary/20 pr-12 transition-all"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-blue-600/20 opacity-0 group-focus-within:opacity-100 -z-10 blur-xl transition-opacity" />
                    </div>
                  </div>
                  
                   <Button
                     type="submit"
                     disabled={loading}
                     className="w-full h-12 bg-gradient-to-r from-[hsl(220,75%,48%)] to-[hsl(187,82%,37%)] hover:from-[hsl(220,75%,42%)] hover:to-[hsl(187,82%,32%)] text-white font-medium rounded-lg shadow-lg shadow-[hsl(187,82%,37%)]/20 transition-all hover:shadow-xl hover:shadow-[hsl(187,82%,37%)]/25 hover:-translate-y-0.5 tracking-wide"
                     style={{ fontFamily: "'Outfit', sans-serif" }}
                   >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        登录
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSignUp}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-white/70 text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      显示名称 <span className="text-white/40">(可选)</span>
                    </Label>
                    <div className="relative group">
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="您的名称"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-blue-600/20 opacity-0 group-focus-within:opacity-100 -z-10 blur-xl transition-opacity" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-username" className="text-white/70 text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      账号
                    </Label>
                    <div className="relative group">
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="请输入账号"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-blue-600/20 opacity-0 group-focus-within:opacity-100 -z-10 blur-xl transition-opacity" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-white/70 text-sm font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      密码
                    </Label>
                    <div className="relative group">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="至少6个字符"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-xl focus:border-primary/50 focus:ring-primary/20 pr-12 transition-all"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-blue-600/20 opacity-0 group-focus-within:opacity-100 -z-10 blur-xl transition-opacity" />
                    </div>
                  </div>
                  
                   <Button
                     type="submit"
                     disabled={loading}
                     className="w-full h-12 bg-gradient-to-r from-[hsl(220,75%,48%)] to-[hsl(187,82%,37%)] hover:from-[hsl(220,75%,42%)] hover:to-[hsl(187,82%,37%,0.9)] text-white font-medium rounded-lg shadow-lg shadow-[hsl(187,82%,37%)]/20 transition-all hover:shadow-xl hover:shadow-[hsl(187,82%,37%)]/25 hover:-translate-y-0.5 tracking-wide"
                     style={{ fontFamily: "'Outfit', sans-serif" }}
                   >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        创建账户
                      </>
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-8 pb-8">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-white/30 text-xs" style={{ fontFamily: "'Outfit', sans-serif" }}>工业视觉智能平台</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
