package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HttpHello 是给 Expo 网络调试页使用的轻量健康检查接口。
func HttpHello(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "hello http",
	})
}

// HttpNoContent 返回空响应，方便本地调试时吞掉无意义的探测请求。
func HttpNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}
