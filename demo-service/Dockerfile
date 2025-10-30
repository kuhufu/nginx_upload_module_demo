FROM golang:alpine AS builder

WORKDIR /app

# 复制源代码和依赖文件
COPY main.go go.mod .

# 构建应用
RUN go build -o demo-service

# 运行阶段
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# 从构建阶段复制二进制文件
COPY --from=builder /app/demo-service .

# 暴露端口
EXPOSE 8082

# 运行应用
CMD ["./demo-service"]