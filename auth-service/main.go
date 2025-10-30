package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	// 设置HTTP路由
	http.HandleFunc("/auth", authHandler)
	http.HandleFunc("/health", healthHandler)

	// 启动HTTP服务器
	port := ":8080"
	fmt.Printf("认证服务启动，监听端口 %s\n", port)
	fmt.Println("可用端点:")
	fmt.Println("- GET|POST /auth   - 认证检查")
	fmt.Println("- GET /health - 健康检查")

	log.Fatal(http.ListenAndServe(port, nil))
}

// 认证处理器
func authHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("收到认证请求")
	// 支持GET和POST方法（GET用于Nginx auth_request模块）
	if r.Method != "POST" && r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	// 从请求头获取认证信息
	authHeader := r.Header.Get("Authorization")

	// 简单的认证逻辑（实际项目中应该使用更安全的认证方式）
	if authHeader == "Bearer valid-token" {
		// 认证成功
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"authenticated": true, "user": "test-user"}`)
	} else {
		// 认证失败
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintf(w, `{"authenticated": false, "error": "Invalid token"}`)
	}
}

// 健康检查处理器
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status": "healthy", "service": "auth-service"}`)
}
