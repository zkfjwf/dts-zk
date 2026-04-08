package config

import (
	"log"

	"github.com/spf13/viper"
)

type Config struct {
	// Port 是 Gin 开发服务对外监听的端口。
	Port int `mapstructure:"port"`
}

// GlobalConfig 保存当前进程初始化完成后的全局配置快照。
var GlobalConfig Config

// InitConfig 读取 YAML 配置和环境变量覆盖项，并写入全局共享配置。
func InitConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("internal/config")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if err := viper.Unmarshal(&GlobalConfig); err != nil {
		log.Fatalf("failed to parse config: %v", err)
	}
}
