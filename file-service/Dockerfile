FROM golang:alpine AS builder

WORKDIR /app

# 复制go.mod和go.sum文件
COPY go.mod .

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN go build -o file-service

# 运行阶段
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# 从构建阶段复制二进制文件
COPY --from=builder /app/file-service .

# 暴露端口
EXPOSE 8081

# 运行应用
CMD ["./file-service"]