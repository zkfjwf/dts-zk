package main

import (
	"fmt"
	"time"
	"travel/internal/config"
	"travel/internal/http"
	"travel/internal/ws"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// main 启动 Gin 服务，供 Expo 客户端在本地开发时访问接口。
func main() {
	// 先读取本地配置文件，得到当前开发服务要监听的端口。
	config.InitConfig()
	addr := fmt.Sprintf(":%d", config.GlobalConfig.Port)

	// Gin 默认携带日志与恢复中间件，足够支撑当前开发环境。
	r := gin.Default()

	// 本地开发时主要服务移动端接口，并兼容调试阶段的跨域请求。
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 当前仅保留最小调试接口：HTTP 健康检查、favicon 空响应和 WebSocket 回声服务。
	r.GET("/hello", http.HttpHello)
	r.GET("/favicon.ico", http.HttpNoContent)
	r.GET("/ws", ws.WsHello)

	r.Run(addr)
}
