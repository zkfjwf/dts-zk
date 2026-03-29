import { useEffect, useRef, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";

const HTTP_URL = process.env.EXPO_PUBLIC_API_URL;
const HELLO_API = HTTP_URL ? `${HTTP_URL}/hello` : "";
const WS_URL = HTTP_URL ? `${HTTP_URL}/ws` : "";

export default function NetworkTestPage() {
  const [httpResponse, setHttpResponse] = useState("");
  const [wsMessages, setWsMessages] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const testHttp = async () => {
    if (!HELLO_API) {
      setHttpResponse("请先设置 EXPO_PUBLIC_API_URL");
      return;
    }

    try {
      setHttpResponse("请求中...");
      const response = await fetch(HELLO_API);
      const data = await response.json();
      setHttpResponse(JSON.stringify(data));
    } catch (error) {
      setHttpResponse(`HTTP 请求失败：${String(error)}`);
    }
  };

  const testWs = () => {
    if (!WS_URL) {
      setWsMessages((prev) => [...prev, "请先设置 EXPO_PUBLIC_API_URL"]);
      return;
    }

    if (wsRef.current) {
      wsRef.current.send("来自 Expo 的问候");
      setWsMessages((prev) => [...prev, "-> 已发送：来自 Expo 的问候"]);
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsMessages((prev) => [...prev, "WebSocket 已连接"]);
      ws.send("你好，服务器，我已经连接成功。");
    };

    ws.onmessage = (event) => {
      setWsMessages((prev) => [...prev, `<- 收到：${event.data}`]);
    };

    ws.onerror = () => {
      setWsMessages((prev) => [...prev, "WebSocket 出现错误"]);
    };

    ws.onclose = () => {
      setWsMessages((prev) => [...prev, "WebSocket 已关闭"]);
      wsRef.current = null;
    };
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>网络连接测试</Text>

      <View style={styles.section}>
        <Button title="测试 HTTP（GET /hello）" onPress={testHttp} />
        <Text style={styles.resultText}>HTTP 结果：{httpResponse}</Text>
      </View>

      <View style={styles.section}>
        <Button
          title={
            wsRef.current ? "发送一条 WS 消息" : "连接 WebSocket 并发送消息"
          }
          onPress={testWs}
          color="#007AFF"
        />
        <Button
          title="断开 WebSocket"
          onPress={() => wsRef.current?.close()}
          color="#FF3B30"
        />
        <Text style={styles.resultText}>WS 消息记录：</Text>
        {wsMessages.map((msg, index) => (
          <Text key={index} style={styles.msgText}>
            {msg}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 30,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    gap: 10,
  },
  resultText: {
    marginTop: 10,
    fontSize: 16,
    color: "#333",
  },
  msgText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
