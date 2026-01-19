-- 修复硬件表RLS策略：将SELECT改为公开可读（硬件库是公共资源）

-- 删除现有的 authenticated 限制策略
DROP POLICY IF EXISTS "Authenticated users can view cameras" ON cameras;
DROP POLICY IF EXISTS "Authenticated users can view lenses" ON lenses;
DROP POLICY IF EXISTS "Authenticated users can view lights" ON lights;
DROP POLICY IF EXISTS "Authenticated users can view controllers" ON controllers;

-- 创建新的公开读取策略（所有用户都可以查看硬件数据）
CREATE POLICY "Anyone can view cameras" ON cameras FOR SELECT USING (true);
CREATE POLICY "Anyone can view lenses" ON lenses FOR SELECT USING (true);
CREATE POLICY "Anyone can view lights" ON lights FOR SELECT USING (true);
CREATE POLICY "Anyone can view controllers" ON controllers FOR SELECT USING (true);