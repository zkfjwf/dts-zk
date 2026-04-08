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
	config.InitConfig()
	addr := fmt.Sprintf(":%d", config.GlobalConfig.Port)

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

	r.GET("/hello", http.HttpHello)
	r.GET("/favicon.ico", http.HttpNoContent)
	r.GET("/ws", ws.WsHello)

	r.Run(addr)
}
