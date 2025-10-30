package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
)

type UploadResponse struct {
	Message string            `json:"message"`
	Status  string            `json:"status"`
	Files   []FileInfo        `json:"files,omitempty"`
	Form    map[string]string `json:"form,omitempty"`
}

type FileInfo struct {
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	Path        string `json:"path,omitempty"`
}

func main() {
	// 设置HTTP路由
	http.HandleFunc("/upload", uploadHandler)
	http.HandleFunc("/health", healthHandler)

	// 启动HTTP服务器
	port := ":8081"
	fmt.Printf("文件处理服务启动，监听端口 %s\n", port)
	fmt.Println("可用端点:")
	fmt.Println("- POST /upload - 文件上传处理")
	fmt.Println("- GET /health  - 健康检查")

	log.Fatal(http.ListenAndServe(port, nil))
}

// 文件上传处理器
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("收到上传请求")
	if r.Method != "POST" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	// 打印整个请求
	reqDump, err := httputil.DumpRequest(r, true)
	if err != nil {
		http.Error(w, "请求转储错误", http.StatusInternalServerError)
		return
	}
	fmt.Println(string(reqDump))

	// 解析multipart/form-data格式
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB限制
		http.Error(w, "解析表单错误", http.StatusBadRequest)
		return
	}

	// 提取表单字段
	form := make(map[string]string)
	for key, values := range r.MultipartForm.Value {
		if len(values) > 0 {
			form[key] = values[0]
		}
	}

	// 提取文件信息
	var files []FileInfo
	for _, fileHeaders := range r.MultipartForm.File {
		for _, fileHeader := range fileHeaders {
			fileInfo := FileInfo{
				Name:        fileHeader.Filename,
				Size:        fileHeader.Size,
				ContentType: fileHeader.Header.Get("Content-Type"),
			}
			files = append(files, fileInfo)
		}
	}

	// 构建响应
	response := UploadResponse{
		Message: "文件上传成功",
		Status:  "success",
		Files:   files,
		Form:    form,
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		http.Error(w, "JSON编码错误", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(jsonData)
}

// 健康检查处理器
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "方法不允许", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status": "healthy", "service": "file-service"}`)
}
