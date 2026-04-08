package config

import (
	"log"

	"github.com/spf13/viper"
)

type Config struct {
	Port int `mapstructure:"port"`
}

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
