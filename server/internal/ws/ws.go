package ws

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	// CheckOrigin 在本地开发阶段保持宽松，方便 Expo 客户端直接连入。
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// WsHello 把 HTTP 请求升级成 WebSocket，并把收到的消息原样回传给客户端。
func WsHello(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("failed to upgrade: ", err)
		return
	}
	defer conn.Close()

	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("disconnected: ", err)
			break
		}
		log.Printf("received: %s\n", message)

		err = conn.WriteMessage(messageType, message)
		if err != nil {
			log.Println("failed to send message: ", err)
			break
		}
	}
}
