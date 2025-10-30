package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	// 设置HTTP路由
	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/hello", helloHandler)

	// 启动HTTP服务器
	port := ":8082"
	fmt.Printf("演示服务启动，监听端口 %s\n", port)
	fmt.Println("可用端点:")
	fmt.Println("- GET /        - 主页")
	fmt.Println("- GET /hello   - Hello World")

	log.Fatal(http.ListenAndServe(port, nil))
}

// 主页处理器
func homeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title>简单HTTP服务</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>欢迎使用简单HTTP服务</h1>
    <p>这是一个使用Go语言实现的简单HTTP服务器。</p>
    
    <div class="endpoint">
        <strong>可用端点:</strong>
        <ul>
            <li><a href="/hello">/hello</a> - Hello World消息</li>
            <li><a href="/health">/health</a> - 健康检查</li>
        </ul>
    </div>
</body>
</html>
`)
}

// Hello World处理器
func helloHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"message": "Hello, World!", "status": "success"}`)
}
