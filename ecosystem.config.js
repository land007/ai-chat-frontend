module.exports = {
  apps: [{
    name: 'ai-chat-server',
    script: './server.js',
    
    // 实例数量（单进程模式）
    instances: 1,
    exec_mode: 'fork',
    
    // 自动重启配置
    autorestart: true,
    watch: false,  // 默认不监控，生产环境用
    max_memory_restart: '500M',
    
    // 环境变量
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    
    // 日志配置
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 重启策略
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    exp_backoff_restart_delay: 100,
    
    // 优雅关闭
    kill_timeout: 5000,
    wait_ready: false,
    listen_timeout: 3000
  }]
};

