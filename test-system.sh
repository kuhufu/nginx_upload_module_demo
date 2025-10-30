#!/bin/bash

echo "=== Nginx文件上传系统测试 ==="
echo ""

# 测试Nginx主页
echo "1. 测试Nginx主页..."
curl -s http://localhost:80/ | grep -q "Nginx文件上传演示系统"
if [ $? -eq 0 ]; then
    echo "✅ Nginx主页访问正常"
else
    echo "❌ Nginx主页访问失败"
fi

# 测试演示服务
echo ""
echo "2. 测试演示服务..."
response=$(curl -s http://localhost:80/demo/hello)
if echo "$response" | grep -q "Hello, World"; then
    echo "✅ 演示服务正常"
    echo "   响应: $response"
else
    echo "❌ 演示服务失败"
fi

# 测试认证端点
echo ""
echo "3. 测试认证端点..."
response=$(curl -s -H "Authorization: Bearer valid-token" http://localhost:80/auth)
if echo "$response" | grep -q "authenticated"; then
    echo "✅ 认证端点正常"
    echo "   响应: $response"
else
    echo "❌ 认证端点失败"
fi

# 测试文件上传端点
echo ""
echo "4. 测试文件上传端点..."
# 创建一个测试文件
echo "这是一个测试文件" > test-file.txt

response=$(curl -s -X POST \
    -H "Authorization: Bearer valid-token" \
    -F "files=@test-file.txt" \
    -F "description=测试文件" \
    http://localhost:80/upload)

if echo "$response" | grep -q "success"; then
    echo "✅ 文件上传端点正常"
    echo "   响应: $response"
else
    echo "❌ 文件上传端点失败"
fi

# 清理测试文件
rm -f test-file.txt

echo ""
echo "=== 测试完成 ==="
echo ""
echo "系统组件:"
echo "- Nginx反向代理: 运行在端口80"
echo "- 认证服务: 运行在端口8080"
echo "- 文件处理服务: 运行在端口8081"
echo "- 演示服务: 运行在端口8082"
echo ""
echo "访问 http://localhost:80 查看演示页面"