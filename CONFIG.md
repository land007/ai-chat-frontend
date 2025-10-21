# 环境变量配置说明

## 部署前配置

在部署应用前，请设置以下环境变量：

### 方法1：使用.env文件
创建 `.env` 文件：
```bash
# 阿里云DashScope API配置
DASHSCOPE_API_KEY=sk-your_actual_api_key_here
DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/api/v1/apps/your_actual_app_id/completion
```

### 方法2：直接设置环境变量
```bash
export DASHSCOPE_API_KEY="sk-your_actual_api_key_here"
export DASHSCOPE_API_URL="https://dashscope.aliyuncs.com/api/v1/apps/your_actual_app_id/completion"
```

### 方法3：在docker-compose中直接设置
修改 docker-compose.yml 文件中的环境变量部分：
```yaml
environment:
  - DASHSCOPE_API_KEY=sk-your_actual_api_key_here
  - DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/api/v1/apps/your_actual_app_id/completion
```

## 获取API密钥

1. 登录阿里云控制台
2. 进入DashScope服务
3. 创建应用并获取API密钥
4. 记录应用ID

## 安全建议

- 不要将真实的API密钥提交到代码仓库
- 使用环境变量或密钥管理服务
- 定期轮换API密钥
- 限制API密钥的访问权限




