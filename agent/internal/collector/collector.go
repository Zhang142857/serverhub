package collector

import (
	"runtime"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// Collector 系统信息采集器
type Collector struct{}

// New 创建采集器
func New() *Collector {
	return &Collector{}
}

// SystemInfo 系统信息
type SystemInfo struct {
	Hostname        string
	Os              string
	Platform        string
	PlatformVersion string
	KernelVersion   string
	Arch            string
	Uptime          int64
	BootTime        int64
	Cpu             *CpuInfo
	Memory          *MemoryInfo
	Disks           []*DiskInfo
	Networks        []*NetworkInfo
	Gpus            []*GpuInfo
}

// CpuInfo CPU信息
type CpuInfo struct {
	Model        string
	Cores        int32
	Threads      int32
	Frequency    float64
	UsagePerCore []float64
}

// MemoryInfo 内存信息
type MemoryInfo struct {
	Total       uint64
	Available   uint64
	Used        uint64
	UsedPercent float64
	SwapTotal   uint64
	SwapUsed    uint64
}

// DiskInfo 磁盘信息
type DiskInfo struct {
	Device      string
	Mountpoint  string
	Fstype      string
	Total       uint64
	Used        uint64
	Free        uint64
	UsedPercent float64
}

// NetworkInfo 网络信息
type NetworkInfo struct {
	Name      string
	Addresses []string
	Mac       string
	BytesSent uint64
	BytesRecv uint64
}

// GpuInfo GPU信息
type GpuInfo struct {
	Name          string
	DriverVersion string
	MemoryTotal   uint64
	MemoryUsed    uint64
	Temperature   float64
	Utilization   float64
}

// Metrics 监控指标
type Metrics struct {
	CpuUsage       float64
	MemoryUsage    float64
	DiskMetrics    []*DiskMetric
	NetworkMetrics []*NetworkMetric
	Load1          float64
	Load5          float64
	Load15         float64
}

// DiskMetric 磁盘指标
type DiskMetric struct {
	Device     string
	ReadBytes  uint64
	WriteBytes uint64
	ReadCount  uint64
	WriteCount uint64
}

// NetworkMetric 网络指标
type NetworkMetric struct {
	Interface   string
	BytesSent   uint64
	BytesRecv   uint64
	PacketsSent uint64
	PacketsRecv uint64
}

// ProcessInfo 进程信息
type ProcessInfo struct {
	Pid           int32
	Ppid          int32
	Name          string
	User          string
	Status        string
	CpuPercent    float64
	MemoryPercent float64
	MemoryRss     uint64
	CreateTime    int64
	Cmdline       string
}

// GetSystemInfo 获取系统信息
func (c *Collector) GetSystemInfo() (*SystemInfo, error) {
	hostInfo, err := host.Info()
	if err != nil {
		return nil, err
	}

	info := &SystemInfo{
		Hostname:        hostInfo.Hostname,
		Os:              hostInfo.OS,
		Platform:        hostInfo.Platform,
		PlatformVersion: hostInfo.PlatformVersion,
		KernelVersion:   hostInfo.KernelVersion,
		Arch:            runtime.GOARCH,
		Uptime:          int64(hostInfo.Uptime),
		BootTime:        int64(hostInfo.BootTime),
	}

	// CPU 信息
	cpuInfo, err := c.getCpuInfo()
	if err == nil {
		info.Cpu = cpuInfo
	}

	// 内存信息
	memInfo, err := c.getMemoryInfo()
	if err == nil {
		info.Memory = memInfo
	}

	// 磁盘信息
	diskInfo, err := c.getDiskInfo()
	if err == nil {
		info.Disks = diskInfo
	}

	// 网络信息
	netInfo, err := c.getNetworkInfo()
	if err == nil {
		info.Networks = netInfo
	}

	return info, nil
}

func (c *Collector) getCpuInfo() (*CpuInfo, error) {
	cpuInfos, err := cpu.Info()
	if err != nil {
		return nil, err
	}

	info := &CpuInfo{
		Cores:   int32(runtime.NumCPU()),
		Threads: int32(runtime.NumCPU()),
	}

	if len(cpuInfos) > 0 {
		info.Model = cpuInfos[0].ModelName
		info.Frequency = cpuInfos[0].Mhz
	}

	// CPU 使用率 - 使用 0 间隔获取即时值，不阻塞
	// 第一次调用可能返回 0，但后续调用会返回正确值
	percentages, err := cpu.Percent(0, true)
	if err == nil {
		info.UsagePerCore = percentages
	}

	return info, nil
}

func (c *Collector) getMemoryInfo() (*MemoryInfo, error) {
	vmem, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	swap, _ := mem.SwapMemory()

	info := &MemoryInfo{
		Total:       vmem.Total,
		Available:   vmem.Available,
		Used:        vmem.Used,
		UsedPercent: vmem.UsedPercent,
	}

	if swap != nil {
		info.SwapTotal = swap.Total
		info.SwapUsed = swap.Used
	}

	return info, nil
}

func (c *Collector) getDiskInfo() ([]*DiskInfo, error) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}

	var disks []*DiskInfo
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}

		disks = append(disks, &DiskInfo{
			Device:      p.Device,
			Mountpoint:  p.Mountpoint,
			Fstype:      p.Fstype,
			Total:       usage.Total,
			Used:        usage.Used,
			Free:        usage.Free,
			UsedPercent: usage.UsedPercent,
		})
	}

	return disks, nil
}

func (c *Collector) getNetworkInfo() ([]*NetworkInfo, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	counters, _ := net.IOCounters(true)
	counterMap := make(map[string]net.IOCountersStat)
	for _, counter := range counters {
		counterMap[counter.Name] = counter
	}

	var networks []*NetworkInfo
	for _, iface := range interfaces {
		var addrs []string
		for _, addr := range iface.Addrs {
			addrs = append(addrs, addr.Addr)
		}

		netInfo := &NetworkInfo{
			Name:      iface.Name,
			Addresses: addrs,
			Mac:       iface.HardwareAddr,
		}

		if counter, ok := counterMap[iface.Name]; ok {
			netInfo.BytesSent = counter.BytesSent
			netInfo.BytesRecv = counter.BytesRecv
		}

		networks = append(networks, netInfo)
	}

	return networks, nil
}

// GetMetrics 获取监控指标
func (c *Collector) GetMetrics() (*Metrics, error) {
	metrics := &Metrics{}

	// CPU 使用率
	cpuPercent, err := cpu.Percent(0, false)
	if err == nil && len(cpuPercent) > 0 {
		metrics.CpuUsage = cpuPercent[0]
	}

	// 内存使用率
	vmem, err := mem.VirtualMemory()
	if err == nil {
		metrics.MemoryUsage = vmem.UsedPercent
	}

	// 负载
	loadAvg, err := load.Avg()
	if err == nil {
		metrics.Load1 = loadAvg.Load1
		metrics.Load5 = loadAvg.Load5
		metrics.Load15 = loadAvg.Load15
	}

	// 磁盘 IO
	diskIO, err := disk.IOCounters()
	if err == nil {
		for name, io := range diskIO {
			metrics.DiskMetrics = append(metrics.DiskMetrics, &DiskMetric{
				Device:     name,
				ReadBytes:  io.ReadBytes,
				WriteBytes: io.WriteBytes,
				ReadCount:  io.ReadCount,
				WriteCount: io.WriteCount,
			})
		}
	}

	// 网络 IO
	netIO, err := net.IOCounters(true)
	if err == nil {
		for _, io := range netIO {
			metrics.NetworkMetrics = append(metrics.NetworkMetrics, &NetworkMetric{
				Interface:   io.Name,
				BytesSent:   io.BytesSent,
				BytesRecv:   io.BytesRecv,
				PacketsSent: io.PacketsSent,
				PacketsRecv: io.PacketsRecv,
			})
		}
	}

	return metrics, nil
}

// ListProcesses 列出进程
func (c *Collector) ListProcesses() ([]*ProcessInfo, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	var processes []*ProcessInfo
	for _, p := range procs {
		name, _ := p.Name()
		user, _ := p.Username()
		status, _ := p.Status()
		cpuPercent, _ := p.CPUPercent()
		memPercent, _ := p.MemoryPercent()
		memInfo, _ := p.MemoryInfo()
		createTime, _ := p.CreateTime()
		cmdline, _ := p.Cmdline()
		ppid, _ := p.Ppid()

		procInfo := &ProcessInfo{
			Pid:           p.Pid,
			Ppid:          ppid,
			Name:          name,
			User:          user,
			CpuPercent:    cpuPercent,
			MemoryPercent: float64(memPercent),
			CreateTime:    createTime,
			Cmdline:       cmdline,
		}

		if len(status) > 0 {
			procInfo.Status = status[0]
		}

		if memInfo != nil {
			procInfo.MemoryRss = memInfo.RSS
		}

		processes = append(processes, procInfo)
	}

	return processes, nil
}
