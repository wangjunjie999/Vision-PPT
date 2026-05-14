import { Helmet } from 'react-helmet-async';
import { MainLayout } from '@/components/layout/MainLayout';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>视觉检测配置系统 - 工业机器视觉方案配置与 PPT 生成平台</title>
        <meta
          name="description"
          content="面向工厂与集成商的工业视觉检测配置平台：可视化搭建工位、相机与镜头方案，自动生成 3D 布局、检测节拍与项目级 PPT 报告。"
        />
        <link rel="canonical" href="/" />
        <meta property="og:title" content="视觉检测配置系统 - 工业机器视觉方案配置平台" />
        <meta
          property="og:description"
          content="可视化搭建工业视觉检测工位，配置硬件、节拍与算法，并一键导出方案 PPT 报告。"
        />
        <meta property="og:url" content="/" />
      </Helmet>
      <MainLayout />
    </>
  );
};

export default Index;
