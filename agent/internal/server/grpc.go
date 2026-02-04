package server

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/creack/pty"
	"github.com/rs/zerolog/log"
	pb "github.com/serverhub/agent/api/proto"
	"github.com/serverhub/agent/internal/collector"
	"github.com/serverhub/agent/internal/executor"
	"github.com/serverhub/agent/internal/security"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// 全局路径验证器
var pathValidator = security.NewPathValidator(security.DefaultSecurityConfig())

// AgentServer 实现 AgentServiceServer
type AgentServer struct {
	pb.UnimplementedAgentServiceServer
	version   string
	collector *collector.Collector
	token     string // 存储 token 用于 Authenticate 验证
}

// NewAgentServer 创建新的 AgentServer
func NewAgentServer(version string, token string) *AgentServer {
	return &AgentServer{
		version:   version,
		collector: collector.New(),
		token:     token,
	}
}

// Authenticate 认证
func (s *AgentServer) Authenticate(ctx context.Context, req *pb.AuthRequest) (*pb.AuthResponse, error) {
	// 验证 token
	if s.token != "" && req.Token != s.token {
		return &pb.AuthResponse{
			Success: false,
			Message: "认证令牌无效",
		}, nil
	}
	return &pb.AuthResponse{
		Success:      true,
		Message:      "认证成功",
		AgentVersion: s.version,
		ExpiresAt:    time.Now().Add(24 * time.Hour).Unix(),
	}, nil
}

// GetSystemInfo 获取系统信息
func (s *AgentServer) GetSystemInfo(ctx context.Context, req *pb.Empty) (*pb.SystemInfo, error) {
	info, err := s.collector.GetSystemInfo()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "获取系统信息失败: %v", err)
	}
	return convertSystemInfo(info), nil
}

// GetMetrics 获取实时监控指标流
func (s *AgentServer) GetMetrics(req *pb.MetricsRequest, stream pb.AgentService_GetMetricsServer) error {
	interval := time.Duration(req.IntervalSeconds) * time.Second
	if interval < time.Second {
		interval = 2 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stream.Context().Done():
			return nil
		case <-ticker.C:
			metrics, err := s.collector.GetMetrics()
			if err != nil {
				log.Error().Err(err).Msg("采集指标失败")
				continue
			}
			pbMetrics := convertMetrics(metrics)
			pbMetrics.Timestamp = time.Now().Unix()
			// 调试日志
			log.Debug().
				Float64("cpu_usage", pbMetrics.CpuUsage).
				Float64("memory_usage", pbMetrics.MemoryUsage).
				Int("network_metrics_count", len(pbMetrics.NetworkMetrics)).
				Msg("发送指标数据")
			if err := stream.Send(pbMetrics); err != nil {
				return err
			}
		}
	}
}

// ExecuteCommand 执行命令
func (s *AgentServer) ExecuteCommand(ctx context.Context, req *pb.CommandRequest) (*pb.CommandResponse, error) {
	timeout := time.Duration(req.TimeoutSeconds) * time.Second
	if timeout == 0 {
		timeout = 60 * time.Second
	}

	result, err := executor.Execute(ctx, req.Command, req.Args, executor.Options{
		WorkingDir: req.WorkingDir,
		Env:        req.Env,
		Timeout:    timeout,
		Sudo:       req.Sudo,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "执行命令失败: %v", err)
	}

	return &pb.CommandResponse{
		ExitCode:   int32(result.ExitCode),
		Stdout:     result.Stdout,
		Stderr:     result.Stderr,
		DurationMs: result.DurationMs,
	}, nil
}

// ExecuteShell 交互式 Shell
func (s *AgentServer) ExecuteShell(stream pb.AgentService_ExecuteShellServer) error {
	firstMsg, err := stream.Recv()
	if err != nil {
		return err
	}

	start := firstMsg.GetStart()
	if start == nil {
		return status.Error(codes.InvalidArgument, "首条消息必须是启动消息")
	}

	shell := start.Shell
	if shell == "" {
		shell = os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/bash"
		}
	}

	cmd := exec.Command(shell)
	cmd.Env = os.Environ()
	for k, v := range start.Env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{
		Rows: uint16(start.Rows),
		Cols: uint16(start.Cols),
	})
	if err != nil {
		return status.Errorf(codes.Internal, "启动 PTY 失败: %v", err)
	}
	defer ptmx.Close()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Error().Err(err).Msg("读取 PTY 失败")
				}
				return
			}
			if err := stream.Send(&pb.ShellOutput{Data: buf[:n]}); err != nil {
				return
			}
		}
	}()

	for {
		msg, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		switch input := msg.Input.(type) {
		case *pb.ShellInput_Data:
			if _, err := ptmx.Write(input.Data); err != nil {
				return status.Errorf(codes.Internal, "写入 PTY 失败: %v", err)
			}
		case *pb.ShellInput_Resize:
			if err := pty.Setsize(ptmx, &pty.Winsize{
				Rows: uint16(input.Resize.Rows),
				Cols: uint16(input.Resize.Cols),
			}); err != nil {
				log.Error().Err(err).Msg("调整 PTY 大小失败")
			}
		}
	}
}

// ReadFile 读取文件
func (s *AgentServer) ReadFile(ctx context.Context, req *pb.FileRequest) (*pb.FileContent, error) {
	content, info, err := executor.ReadFile(req.Path)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "读取文件失败: %v", err)
	}
	return &pb.FileContent{
		Content: content,
		Info:    convertFileInfo(info),
	}, nil
}

// WriteFile 写入文件
func (s *AgentServer) WriteFile(ctx context.Context, req *pb.WriteFileRequest) (*pb.ActionResponse, error) {
	if err := executor.WriteFile(req.Path, req.Content, req.Mode, req.CreateDirs); err != nil {
		return &pb.ActionResponse{Success: false, Error: err.Error()}, nil
	}
	return &pb.ActionResponse{Success: true, Message: "文件已保存"}, nil
}

// ListDirectory 列出目录
func (s *AgentServer) ListDirectory(ctx context.Context, req *pb.DirRequest) (*pb.DirContent, error) {
	files, err := executor.ListDirectory(req.Path, req.Recursive, req.ShowHidden)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "列出目录失败: %v", err)
	}
	return &pb.DirContent{
		Path:  req.Path,
		Files: convertFileInfoList(files),
	}, nil
}

// DeleteFile 删除文件（带安全检查）
func (s *AgentServer) DeleteFile(ctx context.Context, req *pb.FileRequest) (*pb.ActionResponse, error) {
	cleanPath, err := security.SanitizePath(req.Path)
	if err != nil {
		return &pb.ActionResponse{Success: false, Error: "路径安全检查失败: " + err.Error()}, nil
	}

	if err := pathValidator.ValidatePathForWrite(cleanPath); err != nil {
		return &pb.ActionResponse{Success: false, Error: "删除路径被拒绝: " + err.Error()}, nil
	}

	realPath, err := filepath.EvalSymlinks(cleanPath)
	if err == nil && realPath != cleanPath {
		if err := pathValidator.ValidatePathForWrite(realPath); err != nil {
			return &pb.ActionResponse{Success: false, Error: "符号链接目标路径被拒绝: " + err.Error()}, nil
		}
	}

	forbiddenPaths := []string{"/", "/bin", "/sbin", "/usr", "/etc", "/var", "/boot", "/root", "/home"}
	for _, forbidden := range forbiddenPaths {
		if cleanPath == forbidden {
			return &pb.ActionResponse{Success: false, Error: "禁止删除系统关键目录"}, nil
		}
	}

	if err := os.RemoveAll(cleanPath); err != nil {
		return &pb.ActionResponse{Success: false, Error: err.Error()}, nil
	}
	return &pb.ActionResponse{Success: true, Message: "文件已删除"}, nil
}

// TailLog 日志流
func (s *AgentServer) TailLog(req *pb.LogRequest, stream pb.AgentService_TailLogServer) error {
	lineChan, err := executor.TailFile(stream.Context(), req.Path, int(req.Lines), req.Follow)
	if err != nil {
		return status.Errorf(codes.Internal, "读取日志失败: %v", err)
	}

	for line := range lineChan {
		if err := stream.Send(&pb.LogLine{
			Content:   line,
			Timestamp: time.Now().Unix(),
		}); err != nil {
			return err
		}
	}
	return nil
}

// ListServices 列出服务
func (s *AgentServer) ListServices(ctx context.Context, req *pb.ServiceFilter) (*pb.ServiceList, error) {
	services, err := executor.ListServices(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "列出服务失败: %v", err)
	}
	return &pb.ServiceList{Services: convertServiceList(services)}, nil
}

// ServiceAction 服务操作
func (s *AgentServer) ServiceAction(ctx context.Context, req *pb.ServiceActionRequest) (*pb.ActionResponse, error) {
	var action string
	switch req.Action {
	case pb.ServiceAction_SERVICE_START:
		action = "start"
	case pb.ServiceAction_SERVICE_STOP:
		action = "stop"
	case pb.ServiceAction_SERVICE_RESTART:
		action = "restart"
	case pb.ServiceAction_SERVICE_ENABLE:
		action = "enable"
	case pb.ServiceAction_SERVICE_DISABLE:
		action = "disable"
	default:
		return nil, status.Error(codes.InvalidArgument, "未知操作")
	}

	if err := executor.ServiceAction(ctx, req.Name, action); err != nil {
		return &pb.ActionResponse{Success: false, Error: err.Error()}, nil
	}
	return &pb.ActionResponse{Success: true, Message: "操作成功"}, nil
}

// ListProcesses 列出进程
func (s *AgentServer) ListProcesses(ctx context.Context, req *pb.ProcessFilter) (*pb.ProcessList, error) {
	processes, err := s.collector.ListProcesses()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "列出进程失败: %v", err)
	}
	return &pb.ProcessList{Processes: convertProcessList(processes)}, nil
}

// KillProcess 终止进程
func (s *AgentServer) KillProcess(ctx context.Context, req *pb.KillProcessRequest) (*pb.ActionResponse, error) {
	if err := executor.KillProcess(int(req.Pid), int(req.Signal)); err != nil {
		return &pb.ActionResponse{Success: false, Error: err.Error()}, nil
	}
	return &pb.ActionResponse{Success: true, Message: "进程已终止"}, nil
}
