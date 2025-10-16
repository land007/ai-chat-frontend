#!/bin/bash

# AI聊天应用部署脚本
# 使用方法: ./deploy.sh [dev|prod]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境变量
check_env() {
    if [ -z "$DASHSCOPE_API_KEY" ] || [ "$DASHSCOPE_API_KEY" = "your_api_key_here" ]; then
        print_warning "DASHSCOPE_API_KEY未设置或使用默认值"
        print_message "请设置正确的API密钥:"
        print_message "export DASHSCOPE_API_KEY=\"sk-your_actual_api_key_here\""
        print_message "或创建.env文件"
    fi
    
    if [ -z "$DASHSCOPE_API_URL" ] || [ "$DASHSCOPE_API_URL" = "https://dashscope.aliyuncs.com/api/v1/apps/your_app_id/completion" ]; then
        print_warning "DASHSCOPE_API_URL未设置或使用默认值"
        print_message "请设置正确的API地址:"
        print_message "export DASHSCOPE_API_URL=\"https://dashscope.aliyuncs.com/api/v1/apps/your_actual_app_id/completion\""
    fi
}

# 构建镜像
build_image() {
    print_message "开始构建Docker镜像..."
    docker build -t land007/ai-chat-app .
    print_message "Docker镜像构建完成"
}

# 停止现有容器
stop_containers() {
    print_message "停止现有容器..."
    docker-compose down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
}

# 启动开发环境
start_dev() {
    print_message "启动开发环境..."
    docker-compose up -d
    print_message "开发环境启动完成"
    print_message "应用访问地址: http://localhost:3000"
    print_message "API健康检查: http://localhost:3000/api/health"
}

# 启动生产环境
start_prod() {
    print_message "启动生产环境..."
    docker-compose -f docker-compose.prod.yml up -d
    print_message "生产环境启动完成"
    print_message "应用访问地址: http://localhost"
    print_message "API健康检查: http://localhost/api/health"
}

# 显示容器状态
show_status() {
    print_message "容器状态:"
    docker-compose ps
}

# 显示日志
show_logs() {
    print_message "显示应用日志:"
    docker-compose logs -f ai-chat-app
}

# 主函数
main() {
    local environment=${1:-dev}
    
    print_message "AI聊天应用部署脚本"
    print_message "环境: $environment"
    
    check_docker
    check_env
    
    case $environment in
        "dev")
            build_image
            stop_containers
            start_dev
            show_status
            ;;
        "prod")
            build_image
            stop_containers
            start_prod
            show_status
            ;;
        "stop")
            stop_containers
            print_message "所有容器已停止"
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        *)
            print_error "无效的环境参数: $environment"
            print_message "使用方法: $0 [dev|prod|stop|status|logs]"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
