package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	pb "github.com/serverhub/agent/api/proto"
	"github.com/serverhub/agent/internal/auth"
	"github.com/serverhub/agent/internal/server"
	"github.com/spf13/viper"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

var (
	version   = "0.1.0"
	buildTime = "unknown"
)

func main() {
	// 命令行参数
	configFile := flag.String("config", "/etc/serverhub/agent.yaml", "配置文件路径")
	showVersion := flag.Bool("version", false, "显示版本信息")
	genToken := flag.Bool("gen-token", false, "生成新的认证令牌")
	flag.Parse()

	if *showVersion {
		fmt.Printf("ServerHub Agent v%s (built: %s)\n", version, buildTime)
		os.Exit(0)
	}

	if *genToken {
		token, err := auth.GenerateToken()
		if err != nil {
			fmt.Fprintf(os.Stderr, "生成令牌失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("新令牌: %s\n", token)
		os.Exit(0)
	}

	// 初始化日志
	setupLogger()

	// 加载配置
	if err := loadConfig(*configFile); err != nil {
		log.Fatal().Err(err).Msg("加载配置失败")
	}

	// 启动服务
	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("服务启动失败")
	}
}

func setupLogger() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	// 开发环境使用彩色输出
	if os.Getenv("ENV") == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}
}

func loadConfig(configFile string) error {
	viper.SetConfigFile(configFile)
	viper.SetConfigType("yaml")

	// 默认配置
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 9527)
	viper.SetDefault("server.tls.enabled", false)
	viper.SetDefault("auth.token", "")
	viper.SetDefault("metrics.interval", 2)
	viper.SetDefault("log.level", "info")

	// 环境变量覆盖
	viper.AutomaticEnv()

	// 尝试读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return err
		}
		log.Warn().Msg("配置文件不存在，使用默认配置")
	}

	// 设置日志级别
	level, err := zerolog.ParseLevel(viper.GetString("log.level"))
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	return nil
}

func run() error {
	host := viper.GetString("server.host")
	port := viper.GetInt("server.port")
	addr := fmt.Sprintf("%s:%d", host, port)

	// 创建监听器
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("监听端口失败: %w", err)
	}

	// gRPC 服务器选项
	var opts []grpc.ServerOption

	// TLS 配置
	if viper.GetBool("server.tls.enabled") {
		certFile := viper.GetString("server.tls.cert")
		keyFile := viper.GetString("server.tls.key")

		creds, err := credentials.NewServerTLSFromFile(certFile, keyFile)
		if err != nil {
			return fmt.Errorf("加载TLS证书失败: %w", err)
		}
		opts = append(opts, grpc.Creds(creds))
		log.Info().Msg("TLS 已启用")
	}

	// 添加认证拦截器
	token := viper.GetString("auth.token")
	if token == "" {
		log.Warn().Msg("未设置认证令牌，建议使用 --gen-token 生成")
	}
	authInterceptor := auth.NewAuthInterceptor(token)
	opts = append(opts,
		grpc.UnaryInterceptor(authInterceptor.Unary()),
		grpc.StreamInterceptor(authInterceptor.Stream()),
	)

	// 创建 gRPC 服务器
	grpcServer := grpc.NewServer(opts...)

	// 注册服务
	agentServer := server.NewAgentServer(version, token)
	pb.RegisterAgentServiceServer(grpcServer, agentServer)

	// 优雅关闭
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Info().Msg("收到关闭信号，正在停止服务...")
		grpcServer.GracefulStop()
		cancel()
	}()

	log.Info().
		Str("version", version).
		Str("address", addr).
		Msg("ServerHub Agent 已启动")

	// 启动服务
	if err := grpcServer.Serve(listener); err != nil {
		return fmt.Errorf("gRPC服务错误: %w", err)
	}

	<-ctx.Done()
	log.Info().Msg("服务已停止")
	return nil
}
