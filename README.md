# Nginx文件上传系统

一个基于Nginx和Go的微服务架构文件上传系统，支持认证、文件上传和静态文件服务。

## 项目概述

本项目演示了如何使用Nginx作为反向代理，结合多个Go微服务构建一个完整的文件上传系统。系统包含认证服务、文件处理服务和演示服务，通过Nginx的`auth_request`模块实现统一的认证机制。

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   客户端请求     │───▶│   Nginx代理     │───▶│   后端服务      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ├─ 认证检查 ──────────────┤
                              │                        │
                              ├─ 文件上传 ──────────────┤
                              │                        │
                              └─ 静态服务 ──────────────┘
```

## 功能特性

- ✅ **统一认证**: 使用Nginx `auth_request`模块实现请求级别的认证
- ✅ **文件上传**: 支持大文件上传、断点续传功能
- ✅ **多文件管理**: 文件列表支持批量上传和独立管理
- ✅ **批量操作**: 全部开始、全部暂停、清空列表功能
- ✅ **独立控制**: 每个文件独立的上传、暂停、继续、取消、删除操作
- ✅ **实时进度**: 每个文件独立的进度条和速度显示
- ✅ **静态文件服务**: 提供静态文件访问服务
- ✅ **微服务架构**: 模块化设计，易于扩展和维护
- ✅ **Docker容器化**: 使用Docker Compose一键部署
- ✅ **健康检查**: 各服务提供健康检查端点

## 项目结构

```
nginx_upload_module_demo/
├── auth-service/          # 认证服务 (Go)
│   ├── Dockerfile        # 两阶段构建配置
│   ├── go.mod           # Go模块文件
│   └── main.go          # 认证服务主程序
├── demo-service/         # 演示服务 (Go)
│   ├── Dockerfile        # 两阶段构建配置
│   ├── go.mod           # Go模块文件
│   └── main.go          # 演示服务主程序
├── file-service/         # 文件处理服务 (Go)
│   ├── Dockerfile        # 两阶段构建配置
│   ├── go.mod           # Go模块文件
│   └── main.go          # 文件服务主程序
├── nginx-service/         # Nginx代理服务
│   ├── Dockerfile        # 包含upload_module的编译配置
│   ├── conf.d/           # Nginx配置文件目录
│   │   └── default.conf  # 主配置文件（含断点续传）
│   ├── html/             # 静态文件目录
│   │   └── index.html    # 上传演示页面（含前端上传逻辑）
│   └── nginx.conf        # Nginx主配置
├── compose.yaml          # Docker Compose配置
├── test-system.sh        # 系统测试脚本
└── README.md            # 项目说明文档
```

## 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Git

### 启动系统

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd nginx_upload_module_demo
   ```

2. **构建并启动服务**
   ```bash
   docker compose up --build
   ```
   > 注意：首次构建会下载Nginx源码并编译upload_module，需要几分钟时间

3. **验证服务状态**
   ```bash
   ./test-system.sh
   ```

### 访问服务

- **主页（上传演示页面）**: http://localhost:80
- **演示服务**: http://localhost:80/demo/
- **健康检查**: http://localhost:80/health
- **Hello World**: http://localhost:80/demo/hello

## 服务详情

### 1. Nginx代理服务 (`nginx-service`)

**功能**: 反向代理、请求路由、认证检查、文件上传处理

**技术栈**: Nginx + nginx-upload-module（第三方模块）

**Docker构建特点**:
- 两阶段构建：第一阶段编译Nginx源码，第二阶段创建运行时镜像
- 自动下载与基础镜像版本一致的Nginx源码
- 从GitHub克隆并集成nginx-upload-module
- 编译包含完整的Nginx模块和第三方upload_module

#### Nginx Upload Module 详解

本项目使用了Nginx的第三方模块 **nginx-upload-module**，该模块专门用于处理大文件上传，提供了比传统Nginx更好的上传处理能力。

**主要特性**:
- **大文件上传**: 支持GB级别的大文件上传
- **断点续传**: 支持上传中断后的续传功能
- **内存优化**: 文件直接写入磁盘，避免内存占用过大
- **进度监控**: 提供上传进度跟踪
- **表单处理**: 自动解析multipart/form-data格式

**关键配置参数**:
```nginx
# 启用上传模块
upload_pass /upload_handler;

# 文件存储设置
upload_store /var/nginx_uploads;
upload_store_access user:rw group:rw all:rw;

# 断点续传配置
upload_resumable on;
upload_state_store /var/nginx_uploads/state_files;

# 大小限制
client_max_body_size 100m;    # 请求体最大大小
upload_max_file_size 1024m;   # 单个文件最大大小

# 表单字段处理
upload_set_form_field $upload_field_name.name "$upload_file_name";
upload_set_form_field $upload_field_name.content_type "$upload_content_type";
upload_set_form_field $upload_field_name.path "$upload_tmp_path";
```

#### 断点续传功能说明

**工作原理**:
1. 客户端将大文件分割成固定大小的块（默认1MB）
2. 每个分块通过 `Content-Range` 请求头指定上传范围
3. Nginx根据 `Session-ID` 请求头保存上传状态到状态存储目录
4. 服务器返回 `201` 状态码和 `Range` 响应头，告知客户端已接收的字节范围
5. 如果上传中断，客户端从 `Range` 头中获取断点位置并继续上传
6. 上传完成后返回 `200` 状态码

**前端实现要求**:

要实现断点续传，前端需要满足以下要求：

1. **分块上传**: 将大文件分割成较小的块（默认1MB）进行上传
2. **状态管理**: 保存每个文件的上传进度和Session-ID
3. **重试机制**: 在网络中断时能够重新发起上传请求
4. **进度跟踪**: 实时显示上传进度

**前端功能**:
- ✅ **多文件上传**: 支持选择多个文件同时上传
- ✅ **文件列表管理**: 每个文件独立的状态显示和控制
- ✅ **批量操作**: 全部开始、全部暂停、清空列表
- ✅ **独立控制**: 每个文件独立的上传、暂停、继续、取消、删除
- ✅ **实时进度条**: 每个文件独立的进度条、速度和状态显示
- ✅ **上传结果展示**: JSON格式响应展示
- ✅ **删除功能**: 从列表中删除单个文件（带淡出动画）
- ✅ **断点续传**: 支持暂停后继续上传
- ✅ **状态标识**: 待上传/上传中/已暂停/已完成/错误状态区分
- ✅ **Session-ID自动生成**: 基于文件元数据生成唯一会话ID

#### HTTP请求头要求

根据前端实现代码，系统使用以下HTTP请求头进行文件上传：

**必需请求头**:
- **Authorization**: Bearer令牌认证（必需）
  ```
  Authorization: Bearer valid-token
  ```

**文件上传相关请求头**:
- **Content-Disposition**: 文件附件信息，包含文件名编码
  ```
  Content-Disposition: attachment; filename*=UTF-8''encoded-filename
  ```
- **Content-Type**: 二进制流格式（必需）
  ```
  Content-Type: application/octet-stream
  ```
- **Content-Range**: 用于指定上传范围（分块上传时使用）
  ```
  Content-Range: bytes 0-1048575/2097152
  ```
- **Content-Length**: 当前块的大小（必需）
  ```
  Content-Length: 1048576
  ```

**自定义请求头（用于状态跟踪）**:
- **Session-ID**: 会话标识符，用于断点续传状态管理
  ```
  Session-ID: session_abc123def456
  ```

**示例请求头（基于实际实现）**:
```http
POST /upload HTTP/1.1
Host: localhost:80
Authorization: Bearer valid-token
Content-Disposition: attachment; filename*=UTF-8''test-file.txt
Content-Type: application/octet-stream
Content-Length: 1048576
Content-Range: bytes 0-1048575/2097152
Session-ID: session_abc123def456
```

**响应头说明**:
- **Range**: 服务器返回的已接收字节范围（用于断点续传）
  ```
  Range: 0-70254591/99532938
  ```
- **Status**: 上传状态码（201表示需要继续上传，200表示完成）
- **Content-Type**: 响应内容类型（通常为application/json）

**前端代码示例（基于实际实现）**:

```javascript
// 上传相关常量
const UPLOAD_CONFIG = {
    CHUNK_SIZE: 1024 * 1024, // 1MB分块大小
    CONTINUE_DELAY: 100, // 继续上传延迟(ms)
    COMPLETE_DELAY: 2000 // 完成状态显示延迟(ms)
};

// 文件队列
let fileQueue = [];

/**
 * 添加文件到队列
 */
function addFilesToQueue(files) {
    const token = document.getElementById('token').value;
    const description = document.getElementById('description').value;

    for (const file of files) {
        const fileId = generateFileId(file);

        // 检查文件是否已存在
        if (fileQueue.find(f => f.id === fileId)) continue;

        const fileItem = {
            id: fileId,
            file: file,
            session: generateSessionId(file),
            token: token,
            description: description,
            status: 'pending', // pending, uploading, paused, completed, error
            progress: 0,
            uploadedBytes: 0,
            startTime: null,
            lastUploadedBytes: 0,
            controller: null,
            result: null
        };

        fileQueue.push(fileItem);
        createFileItemElement(fileItem);
    }

    updateBatchButtons();
    updateEmptyState();
}

/**
 * 构建上传请求头
 */
function buildUploadHeaders(fileItem, startByte, endByte, chunkSize) {
    return {
        'Authorization': fileItem.token,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileItem.file.name)}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${startByte}-${endByte}/${fileItem.file.size}`,
        'Session-ID': fileItem.session,
        'Content-Length': chunkSize.toString()
    };
}

/**
 * 开始上传单个文件
 */
function startUpload(fileId) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    fileItem.status = 'uploading';
    fileItem.uploadedBytes = 0;
    fileItem.progress = 0;
    fileItem.startTime = Date.now();
    fileItem.lastUploadedBytes = 0;
    fileItem.controller = new AbortController();

    updateFileItemUI(fileItem);
    performUpload(fileItem);
}

/**
 * 执行文件上传
 */
async function performUpload(fileItem) {
    if (fileItem.status !== 'uploading') return;

    try {
        const startByte = fileItem.uploadedBytes;
        const endByte = Math.min(startByte + UPLOAD_CONFIG.CHUNK_SIZE - 1, fileItem.file.size - 1);
        const fileSlice = fileItem.file.slice(startByte, endByte + 1);

        const headers = buildUploadHeaders(fileItem, startByte, endByte, fileSlice.size);

        const response = await fetch('/upload', {
            method: 'POST',
            headers: headers,
            body: fileSlice,
            signal: fileItem.controller.signal
        });

        if (response.status === 201) {
            // 继续上传
            const rangeHeader = response.headers.get('Range');
            if (rangeHeader) {
                const match = rangeHeader.match(/(\d+)-(\d+)/);
                if (match) {
                    fileItem.uploadedBytes = parseInt(match[2]) + 1;
                } else {
                    fileItem.uploadedBytes = Math.min(startByte + UPLOAD_CONFIG.CHUNK_SIZE, fileItem.file.size);
                }
            } else {
                fileItem.uploadedBytes = Math.min(startByte + UPLOAD_CONFIG.CHUNK_SIZE, fileItem.file.size);
            }

            fileItem.progress = (fileItem.uploadedBytes / fileItem.file.size) * 100;
            updateFileItemUI(fileItem);

            setTimeout(() => performUpload(fileItem), UPLOAD_CONFIG.CONTINUE_DELAY);
            return;
        }

        // 上传完成
        if (response.ok || response.status === 200) {
            fileItem.status = 'completed';
            fileItem.progress = 100;
            fileItem.uploadedBytes = fileItem.file.size;
            updateFileItemUI(fileItem);
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            fileItem.status = 'error';
            updateFileItemUI(fileItem);
        }
    }
}

/**
 * 暂停上传
 */
function pauseUpload(fileId) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem || fileItem.status !== 'uploading') return;

    fileItem.status = 'paused';
    updateFileItemUI(fileItem);
}

/**
 * 继续上传
 */
function resumeUpload(fileId) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem || fileItem.status !== 'paused') return;

    fileItem.status = 'uploading';
    fileItem.startTime = Date.now();
    fileItem.lastUploadedBytes = fileItem.uploadedBytes;

    if (!fileItem.controller || fileItem.controller.signal.aborted) {
        fileItem.controller = new AbortController();
    }

    updateFileItemUI(fileItem);
    performUpload(fileItem);
}

/**
 * 取消上传
 */
function cancelUpload(fileId) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    if (fileItem.controller) {
        fileItem.controller.abort();
    }

    fileItem.status = 'pending';
    fileItem.uploadedBytes = 0;
    fileItem.progress = 0;
    fileItem.controller = null;

    updateFileItemUI(fileItem);
    updateBatchButtons();
}

/**
 * 删除文件
 */
function deleteFile(fileId) {
    const fileItem = fileQueue.find(f => f.id === fileId);
    if (!fileItem) return;

    if (fileItem.controller) {
        fileItem.controller.abort();
    }

    fileQueue = fileQueue.filter(f => f.id !== fileId);

    const itemDiv = document.getElementById(fileId);
    if (itemDiv) {
        itemDiv.remove();
    }

    updateBatchButtons();
    updateEmptyState();
}

/**
 * 批量操作
 */
function startAllUploads() {
    fileQueue.forEach(fileItem => {
        if (fileItem.status === 'pending' || fileItem.status === 'error') {
            startUpload(fileItem.id);
        }
    });
}

function pauseAllUploads() {
    fileQueue.forEach(fileItem => {
        if (fileItem.status === 'uploading') {
            pauseUpload(fileItem.id);
        }
    });
}

function clearAllFiles() {
    fileQueue.forEach(fileItem => {
        if (fileItem.controller) {
            fileItem.controller.abort();
        }
    });

    fileQueue = [];
    updateBatchButtons();
    updateEmptyState();
}

/**
 * 生成文件唯一ID和会话ID
 */
function generateFileId(file) {
    const data = file.name + file.size + file.lastModified;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash = hash & hash;
    }
    return 'file_' + Math.abs(hash).toString(36);
}

function generateSessionId(file) {
    return 'session_' + generateFileId(file);
}
```

**配置特性**:
- 使用`auth_request`模块进行统一认证
- 集成`nginx-upload-module`处理大文件上传
- 启用断点续传功能，支持暂停/继续上传
- 分块上传：默认1MB分块大小，自动合并到最终文件
- 静态文件服务和多服务代理转发
- 上传目录权限自动配置

**关键配置**:
```nginx
# 认证检查（内部端点，只允许Nginx内部调用）
location /auth-check {
    internal;
    proxy_pass http://auth_backend/auth;
    proxy_method POST;  # 强制使用POST方法
    proxy_pass_request_body off;  # 不传递请求体
}

# 文件上传（启用断点续传）
location /upload {
    auth_request /auth-check;     # 认证检查
    upload_pass /upload_handler;  # 转发到后端处理
    upload_resumable on;          # 断点续传
    upload_state_store /var/nginx_uploads/state_files;
    client_max_body_size 100m;    # 请求体最大大小
    upload_max_file_size 1024m;   # 单个文件最大大小
}

# 上传处理（内部端点，Nginx内部调用）
location /upload_handler {
    internal;
    proxy_pass http://file_backend/upload;
}
```

### 2. 认证服务 (`auth-service`)

**功能**: 用户认证、令牌验证

**技术栈**: Go + Docker多阶段构建

**API端点**:
- `GET /auth` - 认证检查（用于Nginx auth_request）
- `POST /auth` - 认证检查
- `GET /health` - 健康检查

**认证逻辑**:
- 检查`Authorization`请求头
- 支持Bearer令牌验证
- 返回200状态码表示认证成功，401表示失败
- 返回JSON格式的认证状态和用户信息

### 3. 文件处理服务 (`file-service`)

**功能**: 文件上传处理、表单解析

**技术栈**: Go + Docker多阶段构建

**API端点**:
- `POST /upload` - 文件上传处理
- `GET /health` - 健康检查

**处理特性**:
- 接收Nginx upload_module转发的multipart/form-data请求
- 解析文件元数据（文件名、大小、内容类型、临时路径）
- 解析表单字段（如描述信息）
- 返回JSON格式的上传结果，包含文件信息和表单数据
- 支持多文件上传

### 4. 演示服务 (`demo-service`)

**功能**: 演示页面、Hello World服务

**技术栈**: Go + Docker多阶段构建

**API端点**:
- `GET /` - HTML主页（可通过Nginx访问）
- `GET /hello` - 返回JSON格式的Hello World消息

## API使用示例

### 1. 认证请求

```bash
# 使用有效令牌
curl -H "Authorization: Bearer valid-token" http://localhost:80/auth

# 响应示例
{
  "authenticated": true,
  "user": "test-user"
}
```

### 2. 文件上传

```bash
# 上传文件（需要认证）
curl -X POST \
  -H "Authorization: Bearer valid-token" \
  -F "files=@example.txt" \
  -F "description=测试文件" \
  http://localhost:80/upload

# 响应示例
{
  "message": "文件上传成功",
  "status": "success",
  "files": [
    {
      "name": "example.txt",
      "size": 1024,
      "content_type": "text/plain"
    }
  ],
  "form": {
    "description": "测试文件"
  }
}
```

### 3. 访问演示服务

```bash
# 访问演示页面
curl http://localhost:80/demo/

# Hello World端点
curl http://localhost:80/demo/hello

# 响应示例
{
  "message": "Hello, World!",
  "status": "success"
}
```

## 配置说明

### 认证配置

系统使用简单的Bearer令牌认证。在生产环境中，建议替换为更安全的认证机制：

1. **修改认证逻辑** (`auth-service/main.go`)
2. **更新令牌验证方式**
3. **添加用户数据库集成**

### 文件上传配置

上传配置位于 `nginx-service/conf.d/default.conf` 中：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `client_max_body_size` | 100m | 请求体最大大小 |
| `upload_max_file_size` | 1024m | 单个文件最大大小 |
| `upload_store` | /var/nginx_uploads | 文件临时存储路径 |
| `upload_state_store` | /var/nginx_uploads/state_files | 断点续传状态存储路径 |
| `upload_resumable` | on | 是否启用断点续传 |

### 网络配置

服务通过Docker网络连接：

- 服务间使用内部网络通信
- Nginx暴露80端口对外服务
- 各微服务使用内部端口

## 开发指南

### 添加新服务

1. **创建服务目录**
   ```bash
   mkdir new-service
   cd new-service
   ```

2. **编写Go服务**
   ```go
   package main
   
   import (
       "fmt"
       "log"
       "net/http"
   )
   
   func main() {
       http.HandleFunc("/", handler)
       log.Fatal(http.ListenAndServe(":8083", nil))
   }
   ```

3. **更新Docker配置**
   - 创建`Dockerfile`
   - 更新`compose.yaml`
   - 更新Nginx配置

### 本地开发

1. **启动完整系统**
   ```bash
   docker compose up
   ```

2. **后台启动**
   ```bash
   docker compose up -d
   ```

3. **查看日志**
   ```bash
   docker compose logs -f nginx
   docker compose logs -f auth-service
   docker compose logs -f file-service
   ```

4. **停止系统**
   ```bash
   docker compose down
   ```

5. **重新构建**
   ```bash
   docker compose up --build
   ```

## 故障排除

### 常见问题

1. **端口冲突**
   - 检查80端口是否被占用
   - 修改`compose.yaml`中的端口映射

2. **认证失败**
   - 检查认证服务是否正常运行
   - 验证令牌格式是否正确

3. **文件上传失败**
   - 检查存储目录权限
   - 验证文件大小限制

### 日志查看

```bash
# 查看所有服务日志
docker compose logs

# 查看特定服务日志
docker compose logs nginx
docker compose logs auth-service
docker compose logs file-service
docker compose logs demo-service

# 实时跟踪日志
docker compose logs -f nginx

# 查看Nginx上传日志（挂载在本地）
tail -f logs/upload.log
tail -f logs/error.log
```

## 部署说明

### 生产环境部署

1. **安全配置**
   - 启用HTTPS（配置SSL证书）
   - 配置防火墙规则，限制外部访问
   - 使用更安全的认证机制（如JWT、OAuth2）
   - 限制上传文件类型和大小
   - 设置适当的文件权限

2. **性能优化**
   - 调整 `worker_processes` 和 `worker_connections`
   - 配置适当的缓存策略
   - 优化文件存储路径（使用高性能磁盘）
   - 调整分块大小（`CHUNK_SIZE`）以适应网络环境

3. **监控告警**
   - 配置健康检查（已集成HEALTHCHECK）
   - 设置日志监控和分析
   - 添加性能指标（Prometheus、Grafana）
   - 配置告警通知

## 许可证

本项目采用MIT许可证。

## 贡献指南

欢迎提交Issue和Pull Request来改进本项目。

## 更新日志

### v2.0.0 (2025)
- 🎉 **重大更新**: 文件列表管理界面
- ✅ 支持多文件同时上传
- ✅ 每个文件独立的进度条和控制按钮
- ✅ 批量操作功能（全部开始/暂停/清空）
- ✅ 单个文件删除功能（带淡出动画）
- ✅ 状态颜色区分（待上传/上传中/已暂停/已完成/错误）
- ✅ 上传完成后进度条保持100%，无页面跳动
- ✅ 空状态提示优化
- ✅ 拖拽多文件上传支持

### v1.0.0 (2024)
- 初始版本发布
- 基础文件上传功能
- 统一认证机制
- Docker容器化部署
- Nginx upload_module 集成
- 断点续传功能（支持暂停/继续/取消）
- 前端上传演示页面

---

**注意**: 本项目主要用于演示和学习目的，生产环境使用前请进行充分的安全测试和性能优化。