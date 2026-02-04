package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/serverhub/agent/internal/collector"
)

// Server REST API 服务器
type Server struct {
	collector *collector.Collector
	token     string
	version   string
}

// NewServer 创建 API 服务器
func NewServer(token, version string) *Server {
	return &Server{
		collector: collector.New(),
		token:     token,
		version:   version,
	}
}

// Response API 响应结构
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// authMiddleware 认证中间件
func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 检查 Authorization header
		auth := r.Header.Get("Authorization")
		if auth == "" {
			s.jsonError(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		// 支持 Bearer token 格式
		token := strings.TrimPrefix(auth, "Bearer ")
		if token != s.token {
			s.jsonError(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}

// corsMiddleware CORS 中间件
func (s *Server) corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// jsonResponse 发送 JSON 响应
func (s *Server) jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Success: true, Data: data})
}

// jsonError 发送错误响应
func (s *Server) jsonError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(Response{Success: false, Error: message})
}

// RegisterRoutes 注册路由
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	// 公开端点
	mux.HandleFunc("/api/health", s.corsMiddleware(s.handleHealth))
	mux.HandleFunc("/api/version", s.corsMiddleware(s.handleVersion))

	// 需要认证的端点
	mux.HandleFunc("/api/system", s.corsMiddleware(s.authMiddleware(s.handleSystemInfo)))
	mux.HandleFunc("/api/metrics", s.corsMiddleware(s.authMiddleware(s.handleMetrics)))
	mux.HandleFunc("/api/processes", s.corsMiddleware(s.authMiddleware(s.handleProcesses)))
}

// handleHealth 健康检查
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().Unix(),
	})
}

// handleVersion 版本信息
func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	s.jsonResponse(w, map[string]string{
		"version": s.version,
		"name":    "ServerHub Agent",
	})
}

// handleSystemInfo 系统信息
func (s *Server) handleSystemInfo(w http.ResponseWriter, r *http.Request) {
	info, err := s.collector.GetSystemInfo()
	if err != nil {
		s.jsonError(w, fmt.Sprintf("Failed to get system info: %v", err), http.StatusInternalServerError)
		return
	}
	s.jsonResponse(w, info)
}

// handleMetrics 监控指标
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics, err := s.collector.GetMetrics()
	if err != nil {
		s.jsonError(w, fmt.Sprintf("Failed to get metrics: %v", err), http.StatusInternalServerError)
		return
	}
	s.jsonResponse(w, metrics)
}

// handleProcesses 进程列表
func (s *Server) handleProcesses(w http.ResponseWriter, r *http.Request) {
	processes, err := s.collector.ListProcesses()
	if err != nil {
		s.jsonError(w, fmt.Sprintf("Failed to list processes: %v", err), http.StatusInternalServerError)
		return
	}
	s.jsonResponse(w, processes)
}
