/**
 * 统一的错误消息处理工具
 * 用于提供用户友好的错误提示
 */

export function getImageSaveErrorMessage(error: unknown): string {
  if (!error) return '保存失败：未知错误';
  
  const err = error as { name?: string; message?: string };
  const errorName = err?.name || '';
  const errorMessage = err?.message || '';
  
  // 字符串长度超限（通常是字体处理问题）
  if (errorName === 'RangeError' && errorMessage.includes('string length')) {
    return '保存失败：图片处理时内存不足，请刷新页面后重试';
  }
  
  // 通用 RangeError
  if (errorName === 'RangeError') {
    return '保存失败：图片内容过大，请刷新页面后重试';
  }
  
  // CORS 安全限制
  if (errorName === 'SecurityError') {
    return '保存失败：浏览器安全限制，请刷新页面后重试';
  }
  
  // 上传错误
  if (errorMessage.includes('upload') || errorMessage.includes('storage')) {
    return '保存失败：上传图片失败，请检查网络连接';
  }
  
  // 数据库更新错误
  if (errorMessage.includes('update') || errorMessage.includes('database')) {
    return '保存失败：更新数据失败，请检查网络连接后重试';
  }
  
  // 网络错误
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
    return '保存失败：网络连接异常，请检查网络后重试';
  }
  
  // Supabase 错误
  if (errorMessage.includes('Bucket not found')) {
    return '保存失败：存储桶未配置，请联系管理员';
  }
  
  if (errorMessage.includes('row-level security')) {
    return '保存失败：权限不足，请重新登录后重试';
  }
  
  // 默认显示原始错误信息
  if (errorMessage) {
    return `保存失败：${errorMessage}`;
  }
  
  return '保存失败：请稍后重试';
}
