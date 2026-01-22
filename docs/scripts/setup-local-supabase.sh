#!/bin/bash
# =============================================
# Vision System 本地 Supabase 一键部署脚本
# 适用于 macOS 和 Linux
# =============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 分隔线
print_separator() {
    echo ""
    echo "============================================="
    echo ""
}

# 检查 Docker
check_docker() {
    print_info "检查 Docker..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装！"
        echo ""
        echo "请先安装 Docker Desktop:"
        echo "  macOS: https://docs.docker.com/desktop/mac/install/"
        echo "  Linux: https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker 未运行！请启动 Docker Desktop。"
        exit 1
    fi
    
    print_success "Docker 已安装并运行"
}

# 检查 Supabase CLI
check_supabase_cli() {
    print_info "检查 Supabase CLI..."
    
    if ! command -v supabase &> /dev/null; then
        print_warning "Supabase CLI 未安装，正在安装..."
        
        # 检测操作系统
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install supabase/tap/supabase
            else
                print_error "请先安装 Homebrew: https://brew.sh"
                exit 1
            fi
        else
            # Linux
            curl -sSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | bash
        fi
    fi
    
    print_success "Supabase CLI 已安装: $(supabase --version)"
}

# 初始化 Supabase
init_supabase() {
    print_info "初始化 Supabase..."
    
    if [ ! -d "supabase" ]; then
        supabase init
        print_success "Supabase 初始化完成"
    else
        print_info "supabase 目录已存在，跳过初始化"
    fi
}

# 启动 Supabase
start_supabase() {
    print_info "启动本地 Supabase 服务..."
    print_warning "首次启动需要下载 Docker 镜像，可能需要几分钟..."
    
    supabase start
    
    print_success "Supabase 服务启动成功！"
}

# 获取 Supabase 配置
get_supabase_config() {
    print_info "获取 Supabase 配置..."
    
    # 获取状态信息
    STATUS=$(supabase status)
    
    # 提取 API URL 和 anon key
    API_URL=$(echo "$STATUS" | grep "API URL" | awk '{print $3}')
    ANON_KEY=$(echo "$STATUS" | grep "anon key" | awk '{print $3}')
    SERVICE_KEY=$(echo "$STATUS" | grep "service_role key" | awk '{print $3}')
    STUDIO_URL=$(echo "$STATUS" | grep "Studio URL" | awk '{print $3}')
    
    if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ]; then
        print_error "无法获取 Supabase 配置信息"
        exit 1
    fi
    
    print_success "配置信息获取成功"
}

# 创建环境变量文件
create_env_file() {
    print_info "创建 .env.local 文件..."
    
    ENV_FILE=".env.local"
    
    # 备份现有文件
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "${ENV_FILE}.backup"
        print_info "已备份现有 .env.local 到 .env.local.backup"
    fi
    
    # 创建新文件
    cat > "$ENV_FILE" << EOF
# 本地 Supabase 配置
# 由 setup-local-supabase.sh 自动生成
# 生成时间: $(date)

VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=local

# 以下为服务端配置（仅供参考，前端不使用）
# SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
EOF
    
    print_success ".env.local 文件创建成功"
}

# 执行数据库迁移
run_migration() {
    print_info "执行数据库迁移..."
    
    MIGRATION_FILE="docs/migration-schema.sql"
    
    if [ -f "$MIGRATION_FILE" ]; then
        print_info "找到迁移文件: $MIGRATION_FILE"
        print_warning "请手动在 Studio SQL Editor 中执行迁移脚本"
        print_info "Studio 地址: $STUDIO_URL"
    else
        print_warning "未找到迁移文件: $MIGRATION_FILE"
    fi
}

# 打印完成信息
print_complete() {
    print_separator
    print_success "🎉 本地 Supabase 部署完成！"
    print_separator
    
    echo "服务地址:"
    echo "  📊 Studio:    $STUDIO_URL"
    echo "  🔌 API:       $API_URL"
    echo "  📧 邮件测试:  http://localhost:54324"
    echo ""
    echo "下一步操作:"
    echo "  1. 打开 Studio: $STUDIO_URL"
    echo "  2. 进入 SQL Editor"
    echo "  3. 执行 docs/migration-schema.sql 创建表结构"
    echo "  4. 执行 docs/data-export.sql 导入示例数据（可选）"
    echo "  5. 运行 npm run dev 启动应用"
    echo ""
    echo "常用命令:"
    echo "  supabase status  - 查看服务状态"
    echo "  supabase stop    - 停止服务"
    echo "  supabase start   - 启动服务"
    echo "  supabase db reset - 重置数据库"
    print_separator
}

# 主流程
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════╗"
    echo "║   Vision System 本地 Supabase 部署脚本       ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo ""
    
    check_docker
    print_separator
    
    check_supabase_cli
    print_separator
    
    init_supabase
    print_separator
    
    start_supabase
    print_separator
    
    get_supabase_config
    create_env_file
    print_separator
    
    run_migration
    
    print_complete
}

# 运行主流程
main "$@"
