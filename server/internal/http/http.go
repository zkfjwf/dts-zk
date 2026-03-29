package http

import (
	"encoding/json"
	"html/template"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HttpHello(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "hello http",
	})
}

func HttpNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

type mapPoint struct {
	ID            string  `json:"id"`
	UserID        string  `json:"userId"`
	Username      string  `json:"username"`
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	Battery       int     `json:"battery"`
	IsCurrentUser bool    `json:"isCurrentUser"`
}

type baiduMapPageData struct {
	AkJSON     template.JS
	PointsJSON template.JS
}

func ServeBaiduLiveMap(c *gin.Context) {
	ak := c.Query("ak")
	pointsQuery := c.Query("points")

	if ak == "" || pointsQuery == "" {
		c.String(http.StatusBadRequest, "missing ak or points")
		return
	}

	var points []mapPoint
	if err := json.Unmarshal([]byte(pointsQuery), &points); err != nil {
		c.String(http.StatusBadRequest, "invalid points payload")
		return
	}

	akJSON, err := json.Marshal(ak)
	if err != nil {
		c.String(http.StatusInternalServerError, "failed to serialize ak")
		return
	}

	pointsJSON, err := json.Marshal(points)
	if err != nil {
		c.String(http.StatusInternalServerError, "failed to serialize points")
		return
	}

	tpl := template.Must(template.New("baidu-live-map").Parse(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html,
      body,
      #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #edf3fb;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const BAIDU_AK = {{.AkJSON}};
      const MAP_POINTS = {{.PointsJSON}};
      const MAP_PAGE_ORIGIN = window.location.origin || window.location.href;
      const MAP_LOAD_TIMEOUT = 15000;
      const SDK_READY_CALLBACK = "__baiduMapSdkReady__";
      const MAP_TRANSLATE_BATCH_SIZE = 10;
      let hasMounted = false;

      function postMessage(payload) {
        if (
          window.ReactNativeWebView &&
          typeof window.ReactNativeWebView.postMessage === "function"
        ) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function formatInfo(item) {
        return (
          '<div style="min-width:180px;color:#1f2d44;font-size:13px;line-height:1.65;">' +
          '<div style="font-weight:700;font-size:14px;margin-bottom:4px;">' +
          item.username +
          (item.isCurrentUser ? "（我）" : "") +
          "</div>" +
          "<div>电量：" +
          item.battery +
          "%</div>" +
          "<div>纬度：" +
          item.latitude.toFixed(6) +
          "</div>" +
          "<div>经度：" +
          item.longitude.toFixed(6) +
          "</div>" +
          "</div>"
        );
      }

      function toErrorMessage(error, fallbackMessage) {
        if (error && typeof error.message === "string") {
          return error.message;
        }
        if (typeof error === "string") {
          return error;
        }
        return fallbackMessage;
      }

      function chunkArray(items, size) {
        const chunks = [];
        for (let index = 0; index < items.length; index += size) {
          chunks.push(items.slice(index, index + size));
        }
        return chunks;
      }

      function translateBatch(batch) {
        return new Promise((resolve, reject) => {
          try {
            if (!window.BMap || !window.BMap.Convertor) {
              resolve(batch);
              return;
            }

            const convertor = new window.BMap.Convertor();
            const pointList = batch.map(
              (item) => new window.BMap.Point(item.longitude, item.latitude),
            );

            convertor.translate(pointList, 1, 5, function (data) {
              if (
                !data ||
                data.status !== 0 ||
                !Array.isArray(data.points) ||
                data.points.length !== batch.length
              ) {
                reject(new Error("百度坐标转换失败。"));
                return;
              }

              resolve(
                batch.map((item, index) => ({
                  ...item,
                  longitude: data.points[index].lng,
                  latitude: data.points[index].lat,
                })),
              );
            });
          } catch (error) {
            reject(error);
          }
        });
      }

      async function translatePoints(points) {
        if (!Array.isArray(points) || points.length === 0) {
          return [];
        }

        if (!window.BMap || !window.BMap.Convertor) {
          return points;
        }

        const translated = [];
        const batches = chunkArray(points, MAP_TRANSLATE_BATCH_SIZE);

        for (const batch of batches) {
          try {
            const converted = await translateBatch(batch);
            translated.push(...converted);
          } catch {
            translated.push(...batch);
          }
        }

        return translated;
      }

      function renderMap(points) {
        if (!window.BMap) {
          throw new Error(
            "百度地图脚本已加载，但 BMap 不可用，请检查浏览器端密钥白名单是否允许当前来源访问：" +
              MAP_PAGE_ORIGIN,
          );
        }

        if (!Array.isArray(points) || points.length === 0) {
          throw new Error("暂无可展示的位置数据。");
        }

        const map = new window.BMap.Map("map");
        const viewPoints = [];

        map.enableScrollWheelZoom(true);
        map.enableContinuousZoom();
        map.enableInertialDragging();
        map.addControl(new window.BMap.NavigationControl());
        map.addControl(new window.BMap.ScaleControl());

        points.forEach((item) => {
          const point = new window.BMap.Point(item.longitude, item.latitude);
          const marker = new window.BMap.Marker(point);
          const label = new window.BMap.Label(
            item.username +
              (item.isCurrentUser ? "（我）" : "") +
              " | 电量 " +
              item.battery +
              "%",
            {
              offset: new window.BMap.Size(18, -10),
            },
          );

          label.setStyle({
            color: "#1f2d44",
            backgroundColor: "#ffffff",
            border: "1px solid #d2deeb",
            borderRadius: "999px",
            padding: "4px 8px",
            fontSize: "12px",
            fontWeight: "600",
            boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
          });

          marker.setLabel(label);
          marker.addEventListener("click", function () {
            map.openInfoWindow(new window.BMap.InfoWindow(formatInfo(item)), point);
          });

          map.addOverlay(marker);
          viewPoints.push(point);
        });

        if (viewPoints.length === 1) {
          map.centerAndZoom(viewPoints[0], 15);
        } else {
          map.setViewport(viewPoints);
        }
      }

      async function mountMap() {
        if (hasMounted) {
          return;
        }

        const translatedPoints = await translatePoints(MAP_POINTS);
        renderMap(translatedPoints);
        hasMounted = true;
        postMessage({ type: "ready" });
      }

      window.addEventListener("error", function (event) {
        const filename =
          event && typeof event.filename === "string" ? event.filename : "";
        const message =
          event && typeof event.message === "string"
            ? event.message
            : "未知脚本错误";

        if (message === "Script error." || /api\\.map\\.baidu\\.com/i.test(filename)) {
          postMessage({
            type: "error",
            message:
              "百度地图脚本触发跨域错误，请检查浏览器端密钥白名单是否允许当前页面来源：" +
              MAP_PAGE_ORIGIN,
          });
          return;
        }

        postMessage({
          type: "error",
          message: message + (filename ? " @ " + filename : ""),
        });
      });

      window.addEventListener("unhandledrejection", function (event) {
        postMessage({
          type: "error",
          message: toErrorMessage(event && event.reason, "未处理的 Promise 异常"),
        });
      });

      (function bootstrap() {
        if (!BAIDU_AK) {
          postMessage({ type: "error", message: "缺少百度地图密钥。" });
          return;
        }

        const timeoutId = window.setTimeout(function () {
          postMessage({
            type: "timeout",
            message:
              "加载百度实时地图超时，请检查设备网络以及浏览器端密钥白名单是否允许当前页面来源：" +
              MAP_PAGE_ORIGIN,
          });
        }, MAP_LOAD_TIMEOUT);

        window[SDK_READY_CALLBACK] = function () {
          window.clearTimeout(timeoutId);
          Promise.resolve()
            .then(mountMap)
            .catch(function (error) {
              postMessage({
                type: "error",
                message: toErrorMessage(error, "实时地图初始化失败。"),
              });
            });
        };

        const script = document.createElement("script");
        script.src =
          "https://api.map.baidu.com/api?v=3.0&ak=" +
          encodeURIComponent(BAIDU_AK) +
          "&callback=" +
          encodeURIComponent(SDK_READY_CALLBACK);
        script.async = true;
        script.onerror = function () {
          window.clearTimeout(timeoutId);
          postMessage({
            type: "error",
            message:
              "百度地图脚本加载失败，请检查设备网络以及浏览器端密钥是否已启用。",
          });
        };
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>`))

	c.Header("Content-Type", "text/html; charset=utf-8")
	if err := tpl.Execute(c.Writer, baiduMapPageData{
		AkJSON:     template.JS(akJSON),
		PointsJSON: template.JS(pointsJSON),
	}); err != nil {
		c.String(http.StatusInternalServerError, "failed to render page")
	}
}

