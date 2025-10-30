# 使用官方 Nginx 作为基础镜像
FROM nginx:alpine AS builder

# 安装编译所需的工具和依赖
RUN apk add --no-cache \
    gcc \
    g++ \
    make \
    libc-dev \
    pcre-dev \
    openssl-dev \
    zlib-dev \
    linux-headers \
    curl \
    git

# 下载 Nginx 源码（与基础镜像版本一致）
RUN NGINX_VERSION=$(nginx -v 2>&1 | grep -o '[0-9]*\.[0-9]*\.[0-9]*') && \
    cd /tmp && \
    curl -fSL https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz -o nginx.tar.gz && \
    tar -zxvf nginx.tar.gz

# 下载并编译 nginx-upload-module
RUN cd /tmp && \
    git clone https://github.com/fdintino/nginx-upload-module.git

# 获取当前 Nginx 的编译参数
RUN nginx -V

# 编译新的 Nginx，包含 upload_module 模块
RUN cd /tmp/nginx-* && \
    ./configure \
        --prefix=/usr/local/nginx \
        --sbin-path=/usr/sbin/nginx \
        --modules-path=/usr/lib/nginx/modules \
        --conf-path=/etc/nginx/nginx.conf \
        --error-log-path=/var/log/nginx/error.log \
        --http-log-path=/var/log/nginx/access.log \
        --pid-path=/var/run/nginx.pid \
        --lock-path=/var/run/nginx.lock \
        --http-client-body-temp-path=/var/cache/nginx/client_temp \
        --http-proxy-temp-path=/var/cache/nginx/proxy_temp \
        --http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp \
        --http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp \
        --http-scgi-temp-path=/var/cache/nginx/scgi_temp \
        --user=nginx \
        --group=nginx \
        --with-compat \
        --with-file-aio \
        --with-threads \
        --with-http_addition_module \
        --with-http_auth_request_module \
        --with-http_dav_module \
        --with-http_flv_module \
        --with-http_gunzip_module \
        --with-http_gzip_static_module \
        --with-http_mp4_module \
        --with-http_random_index_module \
        --with-http_realip_module \
        --with-http_secure_link_module \
        --with-http_slice_module \
        --with-http_ssl_module \
        --with-http_stub_status_module \
        --with-http_sub_module \
        --with-http_v2_module \
        --with-mail \
        --with-mail_ssl_module \
        --with-stream \
        --with-stream_realip_module \
        --with-stream_ssl_module \
        --with-stream_ssl_preread_module \
        --add-module=/tmp/nginx-upload-module && \
    make && \
    make install

# 第二阶段：创建最终镜像
FROM nginx:alpine

# 安装运行时的依赖
RUN apk add --no-cache pcre openssl

# 从构建阶段复制编译好的 Nginx 二进制文件
COPY --from=builder /usr/sbin/nginx /usr/sbin/nginx

# 创建上传文件存储目录
RUN mkdir -p /var/nginx_uploads/state_files && \
    chown -R nginx:nginx /var/nginx_uploads && \
    chmod 755 /var/nginx_uploads && \
    chmod 755 /var/nginx_uploads/state_files


# 暴露端口
EXPOSE 80 443

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]