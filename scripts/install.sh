#!/bin/bash
#
# ServerHub Agent 一键安装脚本
#
# 使用方法:
#   curl -fsSL https://cdn.jsdelivr.net/gh/Zhang142857/serverhub@main/scripts/install.sh | sudo bash
#
# 环境变量:
#   SERVERHUB_VERSION  - 指定版本 (默认: latest)
#   SERVERHUB_TOKEN    - 预设认证令牌
#   SERVERHUB_PORT     - 监听端口 (默认: 9527)
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 配置
GITHUB_REPO="Zhang142857/serverhub"
BINARY_NAME="serverhub-agent"
CONFIG_DIR="/etc/serverhub"
CONFIG_FILE="${CONFIG_DIR}/agent.yaml"
SERVICE_FILE="/etc/systemd/system/serverhub-agent.service"
INSTALL_DIR="/usr/local/bin"
CLI_NAME="serverhub"
VERSION="${SERVERHUB_VERSION:-latest}"
PORT="${SERVERHUB_PORT:-9527}"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 检查 root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

# 检测系统架构
detect_arch() {
    case $(uname -m) in
        x86_64|amd64) echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        armv7l|armv7) echo "armv7" ;;
        *) log_error "不支持的架构: $(uname -m)"; exit 1 ;;
    esac
}

# 检测操作系统
detect_os() {
    case $(uname -s | tr '[:upper:]' '[:lower:]') in
        linux) echo "linux" ;;
        darwin) echo "darwin" ;;
        *) log_error "不支持的操作系统"; exit 1 ;;
    esac
}

# 获取公网 IP
get_public_ip() {
    local ip=""
    local services=("ifconfig.me" "ipinfo.io/ip" "icanhazip.com" "api.ipify.org")
    for svc in "${services[@]}"; do
        ip=$(curl -fsSL --connect-timeout 3 "$svc" 2>/dev/null | tr -d '\n')
        if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "$ip"
            return
        fi
    done
    echo "无法获取"
}

# 获取内网 IP
get_local_ip() {
    hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1 2>/dev/null | awk '{print $7}' | head -1 || echo "无法获取"
}

# 检查端口占用并处理
check_and_free_port() {
    local port=$1
    log_step "检查端口 ${port} 占用情况..."
    
    local pid=$(lsof -ti:${port} 2>/dev/null || ss -tlnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\K\d+' | head -1)
    
    if [ -n "$pid" ]; then
        local proc_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知进程")
        log_warn "端口 ${port} 被进程 ${proc_name} (PID: ${pid}) 占用"
        log_info "正在终止占用进程..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
        
        # 再次检查
        if lsof -ti:${port} &>/dev/null || ss -tln | grep -q ":${port} "; then
            log_error "无法释放端口 ${port}"
            exit 1
        fi
        log_success "端口 ${port} 已释放"
    else
        log_success "端口 ${port} 可用"
    fi
}

# 检查依赖
check_dependencies() {
    log_step "检查必要依赖..."
    
    local missing=()
    
    for cmd in curl tar; do
        if ! command -v $cmd &>/dev/null; then
            missing+=($cmd)
        fi
    done
    
    if [ ${#missing[@]} -eq 0 ]; then
        log_success "依赖检查通过"
        return 0
    fi
    
    log_info "缺少依赖: ${missing[*]}，正在安装..."
    
    if command -v apt-get &>/dev/null; then
        apt-get install -y "${missing[@]}" 2>&1 | grep -v "^$" | tail -5
    elif command -v yum &>/dev/null; then
        yum install -y "${missing[@]}" 2>&1 | grep -v "^$" | tail -5
    elif command -v dnf &>/dev/null; then
        dnf install -y "${missing[@]}" 2>&1 | grep -v "^$" | tail -5
    elif command -v apk &>/dev/null; then
        apk add --no-cache "${missing[@]}" 2>&1 | grep -v "^$" | tail -5
    else
        log_error "无法安装依赖，请手动安装: ${missing[*]}"
        exit 1
    fi
    
    log_success "依赖安装完成"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙..."
    
    # UFW (Ubuntu/Debian)
    if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
        ufw allow ${PORT}/tcp >/dev/null 2>&1
        log_success "UFW 已放行端口 ${PORT}"
    fi
    
    # firewalld (CentOS/RHEL)
    if command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld; then
        firewall-cmd --permanent --add-port=${PORT}/tcp >/dev/null 2>&1
        firewall-cmd --reload >/dev/null 2>&1
        log_success "firewalld 已放行端口 ${PORT}"
    fi
    
    # iptables
    if command -v iptables &>/dev/null; then
        if ! iptables -C INPUT -p tcp --dport ${PORT} -j ACCEPT 2>/dev/null; then
            iptables -I INPUT -p tcp --dport ${PORT} -j ACCEPT 2>/dev/null || true
        fi
    fi
}

# 获取最新版本
get_latest_version() {
    local latest=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    echo "${latest:-v0.1.0}"
}

# 下载二进制文件
download_binary() {
    local os=$1 arch=$2 version=$3
    local filename="${BINARY_NAME}_${os}_${arch}.tar.gz"
    local url="https://github.com/${GITHUB_REPO}/releases/download/${version}/${filename}"
    
    log_step "下载 ServerHub Agent ${version}..."
    log_info "下载地址: ${url}"
    
    local tmp_dir=$(mktemp -d)
    trap "rm -rf ${tmp_dir}" EXIT
    
    # 使用 curl 显示进度
    echo ""
    if ! curl -fL --progress-bar -o "${tmp_dir}/${filename}" "${url}"; then
        log_error "下载失败: ${url}"
        log_info "请检查版本号是否正确，或网络是否可用"
        exit 1
    fi
    echo ""
    
    log_info "解压文件..."
    tar -xzf "${tmp_dir}/${filename}" -C "${tmp_dir}"
    
    log_info "安装到 ${INSTALL_DIR}..."
    mv "${tmp_dir}/${BINARY_NAME}" "${INSTALL_DIR}/"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    
    # 验证安装
    if [ -x "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        local installed_version=$(${INSTALL_DIR}/${BINARY_NAME} --version 2>&1 | head -1)
        log_success "Agent 安装完成: ${installed_version}"
    else
        log_error "安装验证失败"
        exit 1
    fi
}

# 生成令牌
generate_token() {
    if [ -n "${SERVERHUB_TOKEN}" ]; then
        echo "${SERVERHUB_TOKEN}"
    elif command -v openssl &>/dev/null; then
        openssl rand -hex 32
    else
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    fi
}

# 创建配置文件
create_config() {
    local token=$1
    mkdir -p "${CONFIG_DIR}"
    
    cat > "${CONFIG_FILE}" << EOF
server:
  host: "0.0.0.0"
  port: ${PORT}
  tls:
    enabled: false

auth:
  token: "${token}"

metrics:
  interval: 2

log:
  level: "info"
EOF
    
    chmod 600 "${CONFIG_FILE}"
    log_success "配置文件已创建"
}

# 创建 systemd 服务
create_service() {
    cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=ServerHub Agent
After=network.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/${BINARY_NAME} -config ${CONFIG_FILE}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    log_success "systemd 服务已创建"
}

# 创建 CLI 管理工具
create_cli_tool() {
    log_step "安装 serverhub 管理命令..."
    
    cat > "${INSTALL_DIR}/${CLI_NAME}" << 'EOFCLI'
#!/bin/bash
#
# ServerHub Agent 管理工具
#

CONFIG_FILE="/etc/serverhub/agent.yaml"
SERVICE_NAME="serverhub-agent"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

show_help() {
    echo ""
    echo -e "${BOLD}ServerHub Agent 管理工具${NC}"
    echo ""
    echo "用法: serverhub <命令> [参数]"
    echo ""
    echo "命令:"
    echo "  status          查看服务状态"
    echo "  start           启动服务"
    echo "  stop            停止服务"
    echo "  restart         重启服务"
    echo "  logs            查看日志 (Ctrl+C 退出)"
    echo "  info            显示连接信息"
    echo "  token           显示当前令牌"
    echo "  token:reset     重置认证令牌"
    echo "  port <端口>     修改监听端口"
    echo "  config          编辑配置文件"
    echo "  uninstall       卸载 Agent"
    echo "  help            显示帮助"
    echo ""
}

get_public_ip() {
    curl -fsSL --connect-timeout 3 ifconfig.me 2>/dev/null || \
    curl -fsSL --connect-timeout 3 ipinfo.io/ip 2>/dev/null || \
    echo "无法获取"
}

get_local_ip() {
    hostname -I 2>/dev/null | awk '{print $1}' || echo "无法获取"
}

get_token() {
    grep "token:" "$CONFIG_FILE" 2>/dev/null | awk -F'"' '{print $2}'
}

get_port() {
    grep "port:" "$CONFIG_FILE" 2>/dev/null | head -1 | awk '{print $2}'
}

cmd_status() {
    echo ""
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "服务状态: ${GREEN}运行中${NC}"
    else
        echo -e "服务状态: ${RED}已停止${NC}"
    fi
    echo ""
    systemctl status $SERVICE_NAME --no-pager 2>/dev/null | head -15
}

cmd_start() {
    echo "启动服务..."
    systemctl start $SERVICE_NAME
    sleep 1
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}服务已启动${NC}"
    else
        echo -e "${RED}启动失败${NC}"
        journalctl -u $SERVICE_NAME -n 10 --no-pager
    fi
}

cmd_stop() {
    echo "停止服务..."
    systemctl stop $SERVICE_NAME
    echo -e "${YELLOW}服务已停止${NC}"
}

cmd_restart() {
    echo "重启服务..."
    systemctl restart $SERVICE_NAME
    sleep 1
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}服务已重启${NC}"
    else
        echo -e "${RED}重启失败${NC}"
    fi
}

cmd_logs() {
    journalctl -u $SERVICE_NAME -f
}

cmd_info() {
    local public_ip=$(get_public_ip)
    local local_ip=$(get_local_ip)
    local port=$(get_port)
    local token=$(get_token)
    
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}              ServerHub 服务器连接信息                      ${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}公网地址:${NC}  ${BOLD}${public_ip}${NC}"
    echo -e "  ${CYAN}内网地址:${NC}  ${local_ip}"
    echo -e "  ${CYAN}端口:${NC}      ${BOLD}${port}${NC}"
    echo ""
    echo -e "  ${CYAN}认证令牌:${NC}"
    echo -e "  ${GREEN}${token}${NC}"
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "在 ServerHub 客户端添加服务器时，使用以上信息连接"
    echo ""
}

cmd_token() {
    local token=$(get_token)
    echo ""
    echo -e "当前认证令牌: ${GREEN}${token}${NC}"
    echo ""
}

cmd_token_reset() {
    echo ""
    read -p "确定要重置认证令牌吗? 重置后需要在客户端更新令牌 [y/N] " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        return
    fi
    
    local new_token=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n')
    local old_token=$(get_token)
    
    sed -i "s/${old_token}/${new_token}/" "$CONFIG_FILE"
    
    echo "重启服务以应用新令牌..."
    systemctl restart $SERVICE_NAME
    sleep 1
    
    echo ""
    echo -e "新令牌: ${GREEN}${new_token}${NC}"
    echo ""
    echo -e "${YELLOW}请在客户端更新此服务器的令牌${NC}"
}

cmd_port() {
    local new_port=$1
    
    if [ -z "$new_port" ]; then
        echo -e "${RED}请指定新端口: serverhub port <端口号>${NC}"
        return 1
    fi
    
    if ! [[ "$new_port" =~ ^[0-9]+$ ]] || [ "$new_port" -lt 1 ] || [ "$new_port" -gt 65535 ]; then
        echo -e "${RED}无效的端口号: ${new_port}${NC}"
        return 1
    fi
    
    local old_port=$(get_port)
    
    echo "修改端口: ${old_port} -> ${new_port}"
    sed -i "s/port: ${old_port}/port: ${new_port}/" "$CONFIG_FILE"
    
    # 配置防火墙
    if command -v ufw &>/dev/null && ufw status | grep -q "active"; then
        ufw allow ${new_port}/tcp >/dev/null 2>&1
        ufw delete allow ${old_port}/tcp >/dev/null 2>&1
    fi
    
    if command -v firewall-cmd &>/dev/null && systemctl is-active --quiet firewalld; then
        firewall-cmd --permanent --add-port=${new_port}/tcp >/dev/null 2>&1
        firewall-cmd --permanent --remove-port=${old_port}/tcp >/dev/null 2>&1
        firewall-cmd --reload >/dev/null 2>&1
    fi
    
    echo "重启服务..."
    systemctl restart $SERVICE_NAME
    sleep 1
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}端口已修改为 ${new_port}${NC}"
    else
        echo -e "${RED}服务启动失败，请检查端口是否被占用${NC}"
    fi
}

cmd_config() {
    ${EDITOR:-vi} "$CONFIG_FILE"
    echo ""
    read -p "是否重启服务以应用配置? [Y/n] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        systemctl restart $SERVICE_NAME
        echo -e "${GREEN}服务已重启${NC}"
    fi
}

cmd_uninstall() {
    echo ""
    echo -e "${YELLOW}警告: 这将完全卸载 ServerHub Agent${NC}"
    read -p "确定要卸载吗? [y/N] " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消"
        return
    fi
    
    echo "停止服务..."
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    systemctl disable $SERVICE_NAME 2>/dev/null || true
    
    echo "删除文件..."
    rm -f /usr/local/bin/serverhub-agent
    rm -f /usr/local/bin/serverhub
    rm -f /etc/systemd/system/serverhub-agent.service
    rm -rf /etc/serverhub
    
    systemctl daemon-reload
    
    echo ""
    echo -e "${GREEN}ServerHub Agent 已卸载${NC}"
}

# 检查 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户运行此命令${NC}"
    echo "尝试: sudo serverhub $*"
    exit 1
fi

# 主逻辑
case "${1:-help}" in
    status)     cmd_status ;;
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    restart)    cmd_restart ;;
    logs)       cmd_logs ;;
    info)       cmd_info ;;
    token)      cmd_token ;;
    token:reset) cmd_token_reset ;;
    port)       cmd_port "$2" ;;
    config)     cmd_config ;;
    uninstall)  cmd_uninstall ;;
    help|--help|-h) show_help ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
EOFCLI
    
    chmod +x "${INSTALL_DIR}/${CLI_NAME}"
    log_success "serverhub 命令已安装"
}

# 启动服务
start_service() {
    log_step "启动服务..."
    
    log_info "设置开机自启..."
    systemctl enable serverhub-agent >/dev/null 2>&1
    
    log_info "启动 serverhub-agent..."
    systemctl start serverhub-agent
    
    # 等待服务启动
    local count=0
    while [ $count -lt 5 ]; do
        if systemctl is-active --quiet serverhub-agent; then
            break
        fi
        sleep 1
        count=$((count + 1))
        echo -e "  ${CYAN}>${NC} 等待服务启动... ($count/5)"
    done
    
    if systemctl is-active --quiet serverhub-agent; then
        log_success "服务已启动"
        
        # 显示监听端口
        local listen_info=$(ss -tlnp 2>/dev/null | grep serverhub || netstat -tlnp 2>/dev/null | grep serverhub)
        if [ -n "$listen_info" ]; then
            log_info "监听端口:"
            echo "$listen_info" | while read line; do echo -e "  ${CYAN}>${NC} $line"; done
        fi
    else
        log_error "服务启动失败"
        log_info "查看错误日志:"
        journalctl -u serverhub-agent -n 20 --no-pager 2>&1 | while read line; do echo -e "  ${RED}>${NC} $line"; done
        exit 1
    fi
}

# 显示连接信息
show_connection_info() {
    local token=$1
    local public_ip=$(get_public_ip)
    local local_ip=$(get_local_ip)
    
    echo ""
    echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║           ${GREEN}ServerHub Agent 安装成功!${NC}${BOLD}                          ║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║                      ${CYAN}服务器连接信息${NC}${BOLD}                           ║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC}                                                               ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  ${CYAN}公网地址:${NC}  ${BOLD}${public_ip}${NC}"
    printf "${BOLD}║${NC}%63s${BOLD}║${NC}\n" ""
    echo -e "${BOLD}║${NC}  ${CYAN}内网地址:${NC}  ${local_ip}"
    printf "${BOLD}║${NC}%63s${BOLD}║${NC}\n" ""
    echo -e "${BOLD}║${NC}  ${CYAN}端口:${NC}      ${BOLD}${PORT}${NC}"
    printf "${BOLD}║${NC}%63s${BOLD}║${NC}\n" ""
    echo -e "${BOLD}║${NC}  ${CYAN}认证令牌:${NC}"
    printf "${BOLD}║${NC}%63s${BOLD}║${NC}\n" ""
    echo -e "${BOLD}║${NC}  ${GREEN}${token}${NC}"
    printf "${BOLD}║${NC}%63s${BOLD}║${NC}\n" ""
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC}  在 ServerHub 客户端添加服务器时，使用以上信息              ${BOLD}║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║                      ${YELLOW}管理命令${NC}${BOLD}                                 ║${NC}"
    echo -e "${BOLD}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${BOLD}║${NC}  serverhub info        - 查看连接信息                        ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  serverhub status      - 查看服务状态                        ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  serverhub token:reset - 重置认证令牌                        ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  serverhub port <端口> - 修改监听端口                        ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  serverhub logs        - 查看日志                            ${BOLD}║${NC}"
    echo -e "${BOLD}║${NC}  serverhub help        - 查看所有命令                        ${BOLD}║${NC}"
    echo -e "${BOLD}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 停止已有服务
stop_existing() {
    if systemctl is-active --quiet serverhub-agent 2>/dev/null; then
        log_info "停止现有服务..."
        systemctl stop serverhub-agent
    fi
}

# 主函数
main() {
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}       ServerHub Agent 一键安装脚本${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""
    
    check_root
    
    log_info "系统: $(uname -s) $(uname -m)"
    log_info "发行版: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo 'Unknown')"
    echo ""
    
    check_dependencies
    stop_existing
    check_and_free_port "$PORT"
    configure_firewall
    
    local os=$(detect_os)
    local arch=$(detect_arch)
    
    if [ "$VERSION" = "latest" ]; then
        VERSION=$(get_latest_version)
    fi
    log_info "安装版本: ${VERSION}"
    
    download_binary "$os" "$arch" "$VERSION"
    
    local token=$(generate_token)
    create_config "$token"
    create_service
    create_cli_tool
    start_service
    
    show_connection_info "$token"
}

main "$@"
