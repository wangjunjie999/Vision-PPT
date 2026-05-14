import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <title>页面未找到 (404) - 视觉检测配置系统</title>
        <meta name="description" content="您访问的页面不存在或已被移动。返回首页继续配置工业视觉检测方案与生成 PPT 报告。" />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="/404" />
        <meta property="og:title" content="页面未找到 (404) - 视觉检测配置系统" />
        <meta property="og:description" content="您访问的页面不存在，返回视觉检测配置系统首页继续工作。" />
        <meta property="og:url" content="/404" />
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
