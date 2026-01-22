# =============================================
# Vision System 本地 Supabase 一键部署脚本
# 适用于 Windows PowerShell
# =============================================

# 设置编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 颜色输出函数
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] " -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Write-Separator {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
}

# 检查 Docker
function Test-Docker {
    Write-Info "检查 Docker..."
    
    $dockerExists = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerExists) {
        Write-Error "Docker 未安装！"
        Write-Host ""
        Write-Host "请先安装 Docker Desktop:"
        Write-Host "  https://docs.docker.com/desktop/windows/install/"
        exit 1
    }
    
    try {
        docker info 2>&1 | Out-Null
    }
    catch {
        Write-Error "Docker 未运行！请启动 Docker Desktop。"
        exit 1
    }
    
    Write-Success "Docker 已安装并运行"
}

# 检查 Supabase CLI
function Test-SupabaseCLI {
    Write-Info "检查 Supabase CLI..."
    
    $supabaseExists = Get-Command supabase -ErrorAction SilentlyContinue
    if (-not $supabaseExists) {
        Write-Warning "Supabase CLI 未安装，正在安装..."
        
        # 检查是否有 Scoop
        $scoopExists = Get-Command scoop -ErrorAction SilentlyContinue
        if ($scoopExists) {
            scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
            scoop install supabase
        }
        else {
            # 尝试使用 npm
            $npmExists = Get-Command npm -ErrorAction SilentlyContinue
            if ($npmExists) {
                npm install -g supabase
            }
            else {
                Write-Error "请先安装 Scoop 或 Node.js (npm)"
                Write-Host "  Scoop: https://scoop.sh"
                Write-Host "  Node.js: https://nodejs.org"
                exit 1
            }
        }
    }
    
    $version = supabase --version 2>&1
    Write-Success "Supabase CLI 已安装: $version"
}

# 初始化 Supabase
function Initialize-Supabase {
    Write-Info "初始化 Supabase..."
    
    if (-not (Test-Path "supabase")) {
        supabase init
        Write-Success "Supabase 初始化完成"
    }
    else {
        Write-Info "supabase 目录已存在，跳过初始化"
    }
}

# 启动 Supabase
function Start-Supabase {
    Write-Info "启动本地 Supabase 服务..."
    Write-Warning "首次启动需要下载 Docker 镜像，可能需要几分钟..."
    
    supabase start
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Supabase 启动失败！"
        exit 1
    }
    
    Write-Success "Supabase 服务启动成功！"
}

# 获取 Supabase 配置
function Get-SupabaseConfig {
    Write-Info "获取 Supabase 配置..."
    
    $status = supabase status 2>&1
    
    # 解析配置
    $script:ApiUrl = ($status | Select-String "API URL" | ForEach-Object { $_.ToString().Split()[-1] })
    $script:AnonKey = ($status | Select-String "anon key" | ForEach-Object { $_.ToString().Split()[-1] })
    $script:ServiceKey = ($status | Select-String "service_role key" | ForEach-Object { $_.ToString().Split()[-1] })
    $script:StudioUrl = ($status | Select-String "Studio URL" | ForEach-Object { $_.ToString().Split()[-1] })
    
    if (-not $script:ApiUrl -or -not $script:AnonKey) {
        Write-Error "无法获取 Supabase 配置信息"
        exit 1
    }
    
    Write-Success "配置信息获取成功"
}

# 创建环境变量文件
function New-EnvFile {
    Write-Info "创建 .env.local 文件..."
    
    $envFile = ".env.local"
    
    # 备份现有文件
    if (Test-Path $envFile) {
        Copy-Item $envFile "${envFile}.backup"
        Write-Info "已备份现有 .env.local 到 .env.local.backup"
    }
    
    # 创建新文件
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $content = @"
# 本地 Supabase 配置
# 由 setup-local-supabase.ps1 自动生成
# 生成时间: $timestamp

VITE_SUPABASE_URL=$($script:ApiUrl)
VITE_SUPABASE_PUBLISHABLE_KEY=$($script:AnonKey)
VITE_SUPABASE_PROJECT_ID=local

# 以下为服务端配置（仅供参考，前端不使用）
# SUPABASE_SERVICE_ROLE_KEY=$($script:ServiceKey)
"@
    
    Set-Content -Path $envFile -Value $content -Encoding UTF8
    
    Write-Success ".env.local 文件创建成功"
}

# 执行数据库迁移
function Invoke-Migration {
    Write-Info "检查数据库迁移文件..."
    
    $migrationFile = "docs/migration-schema.sql"
    
    if (Test-Path $migrationFile) {
        Write-Info "找到迁移文件: $migrationFile"
        Write-Warning "请手动在 Studio SQL Editor 中执行迁移脚本"
        Write-Info "Studio 地址: $($script:StudioUrl)"
    }
    else {
        Write-Warning "未找到迁移文件: $migrationFile"
    }
}

# 打印完成信息
function Write-Complete {
    Write-Separator
    Write-Host "🎉 " -NoNewline
    Write-Success "本地 Supabase 部署完成！"
    Write-Separator
    
    Write-Host "服务地址:" -ForegroundColor Cyan
    Write-Host "  📊 Studio:    $($script:StudioUrl)"
    Write-Host "  🔌 API:       $($script:ApiUrl)"
    Write-Host "  📧 邮件测试:  http://localhost:54324"
    Write-Host ""
    Write-Host "下一步操作:" -ForegroundColor Cyan
    Write-Host "  1. 打开 Studio: $($script:StudioUrl)"
    Write-Host "  2. 进入 SQL Editor"
    Write-Host "  3. 执行 docs/migration-schema.sql 创建表结构"
    Write-Host "  4. 执行 docs/data-export.sql 导入示例数据（可选）"
    Write-Host "  5. 运行 npm run dev 启动应用"
    Write-Host ""
    Write-Host "常用命令:" -ForegroundColor Cyan
    Write-Host "  supabase status  - 查看服务状态"
    Write-Host "  supabase stop    - 停止服务"
    Write-Host "  supabase start   - 启动服务"
    Write-Host "  supabase db reset - 重置数据库"
    Write-Separator
}

# 主流程
function Main {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   Vision System 本地 Supabase 部署脚本       ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    Test-Docker
    Write-Separator
    
    Test-SupabaseCLI
    Write-Separator
    
    Initialize-Supabase
    Write-Separator
    
    Start-Supabase
    Write-Separator
    
    Get-SupabaseConfig
    New-EnvFile
    Write-Separator
    
    Invoke-Migration
    
    Write-Complete
}

# 运行主流程
Main
