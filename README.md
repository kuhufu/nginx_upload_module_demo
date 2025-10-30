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
- ✅ **静态文件服务**: 提供静态文件访问服务
- ✅ **微服务架构**: 模块化设计，易于扩展和维护
- ✅ **Docker容器化**: 使用Docker Compose一键部署
- ✅ **健康检查**: 各服务提供健康检查端点

## 项目结构

```
nginx_build/
├── auth-service/          # 认证服务
│   ├── Dockerfile        # 认证服务Docker配置
│   ├── go.mod           # Go模块文件
│   └── main.go          # 认证服务主程序
├── demo-service/         # 演示服务
│   ├── Dockerfile        # 演示服务Docker配置
│   ├── go.mod           # Go模块文件
│   └── main.go          # 演示服务主程序
├── file-service/         # 文件处理服务
│   ├── Dockerfile        # 文件服务Docker配置
│   ├── go.mod           # Go模块文件
│   └── main.go          # 文件服务主程序
├── nginx-service/         # Nginx代理服务
│   ├── Dockerfile        # Nginx服务Docker配置
│   ├── conf.d/           # Nginx配置文件目录
│   │   └── default.conf  # 主配置文件
│   ├── html/             # 静态文件目录
│   │   └── index.html    # 主页文件
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
   cd nginx_build
   ```

2. **构建并启动服务**
   ```bash
   docker-compose up --build
   ```

3. **验证服务状态**
   ```bash
   ./test-system.sh
   ```

### 访问服务

- **主页**: http://localhost:80
- **演示服务**: http://localhost:80/demo/
- **健康检查**: http://localhost:80/health

## 服务详情

### 1. Nginx代理服务 (`nginx-service`)

**功能**: 反向代理、请求路由、认证检查、文件上传处理

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
1. 客户端首次上传时，Nginx会生成一个唯一的upload_id
2. 上传过程中，Nginx会保存上传状态到状态存储目录
3. 如果上传中断，客户端可以携带upload_id重新发起请求
4. Nginx根据upload_id恢复上传状态，从断点处继续上传

**前端实现要求**:

要实现断点续传，前端需要满足以下要求：

1. **分块上传**: 将大文件分割成较小的块进行上传
2. **状态管理**: 保存每个文件的上传进度和upload_id
3. **重试机制**: 在网络中断时能够重新发起上传请求
4. **进度跟踪**: 实时显示上传进度

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
/**
 * 构建上传请求头
 * @param {string} token - 认证token
 * @param {number} startByte - 起始字节
 * @param {number} endByte - 结束字节
 * @param {number} fileSize - 文件大小
 * @param {number} chunkSize - 分块大小
 * @returns {Object} 请求头对象
 */
function buildUploadHeaders(token, startByte, endByte, fileSize, chunkSize) {
    return {
        'Authorization': token,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(currentUploadFile.name)}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${startByte}-${endByte}/${fileSize}`,
        'Session-ID': uploadSessionId,
        'Content-Length': chunkSize.toString()
    };
}

/**
 * 执行文件上传（符合nginx upload_module断点续传协议）
 * @param {string} token - 认证token
 * @param {string} description - 文件描述
 * @param {number} startByte - 起始字节位置（用于断点续传）
 */
async function performUpload(token, description, startByte = 0) {
    // 检查是否处于暂停状态，如果是则直接返回
    if (uploadPaused) {
        console.log('上传已暂停，跳过上传操作');
        return;
    }
    
    if (!currentUploadFile) return;
    
    // 更新当前上传位置
    currentUploadStartByte = startByte;
    
    // 创建可取消的fetch请求
    currentUploadController = new AbortController();
    
    try {
        // 创建文件切片（支持断点续传）
        const endByte = Math.min(currentUploadStartByte + UPLOAD_CONFIG.CHUNK_SIZE - 1, currentUploadFile.size - 1);
        const fileSlice = currentUploadFile.slice(currentUploadStartByte, endByte + 1);
        
        // 构建请求头
        const headers = buildUploadHeaders(token, currentUploadStartByte, endByte, currentUploadFile.size, fileSlice.size);
        
        // 发送上传请求
        const response = await fetch('/upload', {
            method: 'POST',
            headers: headers,
            body: fileSlice,
            signal: currentUploadController.signal
        });
        
        // 检查是否需要继续上传
        if (response.status === 201) {
            // 201状态码表示需要继续上传
            const rangeHeader = response.headers.get('Range');
            
            if (rangeHeader) {
                const match = rangeHeader.match(/(\d+)-(\d+)/);
                if (match) {
                    currentUploadStartByte = parseInt(match[2]) + 1;
                } else {
                    currentUploadStartByte = Math.min(currentUploadStartByte + UPLOAD_CONFIG.CHUNK_SIZE, currentUploadFile.size);
                }
            } else {
                currentUploadStartByte = Math.min(currentUploadStartByte + UPLOAD_CONFIG.CHUNK_SIZE, currentUploadFile.size);
            }
            
            const progress = (currentUploadStartByte / currentUploadFile.size) * 100;
            updateProgress(progress, `上传中... ${Math.round(progress)}%`);
            
            // 继续上传下一个分块
            setTimeout(() => performUpload(token, description, currentUploadStartByte), 100);
            return;
        }
        
        // 处理上传完成
        if (response.ok || response.status === 200) {
            updateProgress(100, '上传完成');
            
            // 显示上传结果
            const result = await response.json();
            console.log('上传完成:', result);
        } else {
            updateProgress(0, '上传失败');
            console.error('上传失败:', response.status);
        }
        
    } catch (error) {
        if (uploadPaused) {
            // 上传被暂停
            const progress = (currentUploadStartByte / currentUploadFile.size) * 100;
            updateProgress(progress, '上传已暂停');
        } else if (error.name === 'AbortError') {
            // 用户取消上传
            updateProgress(0, '上传已取消');
        } else {
            // 其他错误
            updateProgress(0, '上传失败');
            console.error('上传失败:', error);
        }
    }
}

/**
 * 生成会话ID（基于文件名、大小和修改时间）
 * @param {File} file - 文件对象
 * @returns {string} - 唯一的会话ID
 */
function generateSessionId(file) {
    const data = file.name + file.size + file.lastModified;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return 'session_' + Math.abs(hash).toString(36);
}

// 上传配置常量
const UPLOAD_CONFIG = {
    CHUNK_SIZE: 1024 * 1024, // 1MB分块大小
    CONTINUE_DELAY: 100, // 继续上传延迟(ms)
    COMPLETE_DELAY: 2000 // 完成状态显示延迟(ms)
};

// 使用示例
const uploadForm = document.getElementById('uploadForm');
uploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const token = document.getElementById('token').value;
    const fileInput = document.getElementById('file');
    const description = document.getElementById('description').value;
    
    if (!fileInput.files.length) {
        alert('请选择文件');
        return;
    }
    
    currentUploadFile = fileInput.files[0];
    currentUploadStartByte = 0;
    uploadSessionId = generateSessionId(currentUploadFile);
    currentUploadToken = token;
    currentUploadDescription = description;
    
    performUpload(token, description, 0);
});
```

**配置特性**:
- 使用`auth_request`模块进行统一认证
- 支持大文件上传（最大1GB）
- 支持断点续传功能
- 静态文件服务和代理转发

**关键配置**:
```nginx
# 认证检查
location /auth-check {
    internal;
    proxy_pass http://auth_backend/auth;
}

# 文件上传
location /upload {
    auth_request /auth-check;
    upload_pass /upload_handler;
    client_max_body_size 100m;
    upload_max_file_size 1024m;
}
```

### 2. 认证服务 (`auth-service`)

**功能**: 用户认证、令牌验证

**API端点**:
- `POST /auth` - 认证检查
- `GET /health` - 健康检查

**认证逻辑**:
- 检查`Authorization`请求头
- 支持Bearer令牌验证
- 返回认证状态和用户信息

### 3. 文件处理服务 (`file-service`)

**功能**: 文件上传处理、表单解析

**API端点**:
- `POST /upload` - 文件上传处理
- `GET /health` - 健康检查

**处理特性**:
- 解析multipart/form-data格式
- 支持多文件上传
- 返回文件信息和表单数据

### 4. 演示服务 (`demo-service`)

**功能**: 演示页面、Hello World服务

**API端点**:
- `GET /` - 主页
- `GET /hello` - Hello World消息
- `GET /health` - 健康检查

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

上传配置位于Nginx配置文件中：

- `client_max_body_size`: 请求体最大大小（默认100MB）
- `upload_max_file_size`: 单个文件最大大小（默认1GB）
- `upload_store`: 文件存储路径

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

1. **启动开发环境**
   ```bash
   docker-compose up -d nginx
   ```

2. **单独运行服务**
   ```bash
   cd auth-service && go run main.go
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
# 查看Nginx日志
docker logs nginx-proxy

# 查看认证服务日志
docker logs auth-service

# 查看文件服务日志
docker logs file-service
```

## 部署说明

### 生产环境部署

1. **安全配置**
   - 启用HTTPS
   - 配置防火墙规则
   - 设置适当的文件权限

2. **性能优化**
   - 调整Nginx worker进程数
   - 配置适当的缓存策略
   - 优化文件存储路径

3. **监控告警**
   - 配置健康检查
   - 设置日志监控
   - 添加性能指标

## 许可证

本项目采用MIT许可证。

## 贡献指南

欢迎提交Issue和Pull Request来改进本项目。

## 更新日志

### v1.0.0 (2024)
- 初始版本发布
- 基础文件上传功能
- 统一认证机制
- Docker容器化部署

---

**注意**: 本项目主要用于演示和学习目的，生产环境使用前请进行充分的安全测试和性能优化。