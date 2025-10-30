# Nginx文件上传认证系统

这是一个基于Nginx的文件上传系统，包含认证和文件处理功能。系统使用Nginx作为反向代理，配合Go语言实现的后端服务。

## 系统架构

- **Nginx**: 反向代理服务器，处理文件上传请求和认证验证
- **认证服务**: 处理用户认证请求 (`/auth` 端点)
- **文件服务**: 处理文件上传请求 (`/upload` 端点)
- **演示服务**: 提供演示页面和测试端点

## 项目结构

```
nginx_build/
├── Dockerfile                    # Nginx镜像构建文件
├── Dockerfile.demo               # 演示服务Dockerfile
├── docker-compose.yaml           # Docker Compose配置文件
├── main.go                       # 演示服务源代码
├── conf.d/
│   └── default.conf              # Nginx配置文件
├── auth-service/
│   ├── main.go                   # 认证服务源代码
│   ├── go.mod                    # Go模块文件
│   └── Dockerfile               # 认证服务Dockerfile
├── file-service/
│   ├── main.go                   # 文件服务源代码
│   ├── go.mod                    # Go模块文件
│   └── Dockerfile               # 文件服务Dockerfile
├── html/
│   └── index.html                # 演示页面
├── uploads/                      # 文件上传目录
├── logs/                         # Nginx日志目录
└── test-system.sh                # 系统测试脚本
```

## 快速启动

### 方法一：使用Docker Compose（推荐）

```bash
# 构建并启动所有服务
docker compose up --build

# 后台运行
docker compose up -d --build
```

### 方法二：手动启动各个服务

如果Docker网络有问题，可以手动启动各个服务：

1. **启动认证服务**
```bash
cd auth-service
go run main.go
# 服务将在 :8080 启动
```

2. **启动文件服务**
```bash
cd file-service
go run main.go
# 服务将在 :8081 启动
```

3. **启动演示服务**
```bash
go run main.go
# 服务将在 :8082 启动
```

4. **启动Nginx**
```bash
# 确保Nginx配置正确后启动
docker run -d \
  -p 80:80 \
  -v $(pwd)/conf.d:/etc/nginx/conf.d \
  -v $(pwd)/html:/usr/share/nginx/html \
  -v $(pwd)/uploads:/tmp/uploads \
  -v $(pwd)/logs:/var/log/nginx \
  --name nginx-proxy \
  nginx-with-upload-auth
```

## 配置说明

### Nginx配置 (`conf.d/default.conf`)

- 上游服务定义：`auth_backend` 和 `file_backend`
- `/upload` 路径：处理文件上传，包含认证验证
- `/upload_handler`：内部文件上传处理
- 文件访问认证和错误处理

### 认证服务

- 端点：`POST /auth`
- 功能：验证Bearer Token
- 默认有效Token：`test-token-123`

### 文件服务

- 端点：`POST /upload`
- 功能：处理multipart/form-data文件上传
- 文件保存路径：`/tmp/uploads`

## 测试系统

运行测试脚本验证系统功能：

```bash
./test-system.sh
```

或者手动测试：

1. **访问演示页面**
   ```
   http://localhost:80
   ```

2. **测试Hello World端点**
   ```bash
   curl http://localhost:80/hello
   ```

3. **测试文件上传**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer test-token-123" \
     -F "files=@test-file.txt" \
     -F "description=测试文件" \
     http://localhost:80/upload
   ```

## 故障排除

### Docker网络问题

如果遇到Docker镜像拉取失败：

1. 检查Docker网络连接
2. 尝试手动拉取基础镜像：
   ```bash
   docker pull nginx:alpine
   docker pull golang:1.21-alpine
   docker pull alpine:latest
   ```

### 端口冲突

确保以下端口没有被占用：
- 80 (Nginx)
- 8080 (认证服务)
- 8081 (文件服务)
- 8082 (演示服务)

## 开发说明

### 修改配置

- Nginx配置：修改 `conf.d/default.conf`
- 服务配置：修改对应服务的 `main.go` 文件
- 重新构建镜像：`docker compose build`

### 添加新功能

1. 在对应服务中添加新的端点
2. 更新Nginx配置以路由新端点
3. 更新测试脚本验证新功能

## 许可证

MIT License