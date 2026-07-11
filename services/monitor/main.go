package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
)

type ContainerStat struct {
	ID         string
	Name       string
	CPU        string
	MemUsage   string
	MemLimit   string
	MemPerc    string
	NetIO      string
	BlockIO    string
	PIDs       string
	Status     string

	CPUVal     float64
	MemUsageMi float64
	MemLimitMi float64
	MemPercVal float64
	NetRxMi    float64
	NetTxMi    float64
	BlkReadMi  float64
	BlkWriteMi float64
	PIDsVal    int
}

func main() {
	flag.Parse()

	stats, err := getStats()
	if err != nil {
		fatal(err.Error())
	}

	if len(stats) == 0 {
		fmt.Println("No running containers found.")
		return
	}

	printStats(stats)
}

func getStats() ([]ContainerStat, error) {
	out, err := exec.Command("docker", "ps", "--format", "{{.ID}}").CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("docker ps failed: %w: %s", err, strings.TrimSpace(string(out)))
	}

	var ids []string
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		id := strings.TrimSpace(scanner.Text())
		if id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return nil, nil
	}

	statsArgs := []string{"stats", "--no-stream", "--format", "{{.ID}}|{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}"}
	statsArgs = append(statsArgs, ids...)
	statsOut, err := exec.Command("docker", statsArgs...).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("docker stats failed: %w: %s", err, strings.TrimSpace(string(statsOut)))
	}

	var stats []ContainerStat
	scanner = bufio.NewScanner(strings.NewReader(string(statsOut)))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "|", 8)
		if len(parts) != 8 {
			continue
		}

		memParts := strings.SplitN(parts[3], " / ", 2)
		memUsage := parts[3]
		memLimit := ""
		if len(memParts) == 2 {
			memUsage = memParts[0]
			memLimit = memParts[1]
		}

		cpuVal, _ := strconv.ParseFloat(strings.TrimSuffix(parts[2], "%"), 64)
		memPercVal, _ := strconv.ParseFloat(strings.TrimSuffix(parts[4], "%"), 64)
		pidsVal, _ := strconv.Atoi(parts[7])

		stats = append(stats, ContainerStat{
			ID:         parts[0],
			Name:       strings.TrimPrefix(parts[1], "/"),
			CPU:        parts[2],
			MemUsage:   memUsage,
			MemLimit:   memLimit,
			MemPerc:    parts[4],
			NetIO:      parts[5],
			BlockIO:    parts[6],
			PIDs:       parts[7],
			CPUVal:     cpuVal,
			MemUsageMi: parseSizeMiB(memUsage),
			MemLimitMi: parseSizeMiB(memLimit),
			MemPercVal: memPercVal,
			NetRxMi:    parseSizeMiB(strings.TrimSpace(strings.Split(parts[5], "/")[0])),
			NetTxMi:    parseSizeMiB(strings.TrimSpace(strings.Split(parts[5], "/")[1])),
			BlkReadMi:  parseSizeMiB(strings.TrimSpace(strings.Split(parts[6], "/")[0])),
			BlkWriteMi: parseSizeMiB(strings.TrimSpace(strings.Split(parts[6], "/")[1])),
			PIDsVal:    pidsVal,
		})
	}

	sort.Slice(stats, func(i, j int) bool {
		return stats[i].Name < stats[j].Name
	})

	return stats, nil
}

func parseSizeMiB(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" {
		return 0
	}

	var numStr string
	var unit string
	if i := strings.IndexAny(s, "0123456789.+-"); i >= 0 {
		numStr = s[i:]
		if j := strings.LastIndexAny(numStr, "0123456789."); j >= 0 {
			unit = strings.TrimSpace(numStr[j+1:])
			numStr = numStr[:j+1]
		}
	} else {
		return 0
	}

	num, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0
	}

	switch strings.ToLower(unit) {
	case "tb", "tib":
		return num * 1024 * 1024
	case "gb", "gib":
		return num * 1024
	case "mb", "mib":
		return num
	case "kb", "kib":
		return num / 1024
	case "b":
		return num / (1024 * 1024)
	default:
		return num
	}
}

func formatSizeMiB(v float64) string {
	if v >= 1024 {
		return fmt.Sprintf("%.2f GiB", v/1024)
	}
	if v >= 1 {
		return fmt.Sprintf("%.2f MiB", v)
	}
	if v >= 1.0/1024 {
		return fmt.Sprintf("%.2f KiB", v*1024)
	}
	return fmt.Sprintf("%.2f B", v*1024*1024)
}

func printStats(stats []ContainerStat) {
	header := fmt.Sprintf("%-25s %-12s %-18s %-18s %-18s %-10s %-18s %-18s",
		"CONTAINER", "CPU %", "MEM USAGE", "MEM LIMIT", "MEM %", "NET I/O", "BLOCK I/O", "PIDs")

	fmt.Println(header)
	fmt.Println(strings.Repeat("-", len(header)))

	var totalCPU, totalMemPerc float64
	var totalMemUsage, totalMemLimit float64
	var totalNetRx, totalNetTx, totalBlkRead, totalBlkWrite float64
	var totalPIDs int

	for _, s := range stats {
		fmt.Printf("%-25s %-12s %-18s %-18s %-18s %-10s %-18s %-18s\n",
			truncate(s.Name, 25),
			s.CPU,
			s.MemUsage,
			truncate(s.MemLimit, 18),
			s.MemPerc,
			s.NetIO,
			s.BlockIO,
			s.PIDs)

		totalCPU += s.CPUVal
		totalMemUsage += s.MemUsageMi
		totalMemLimit += s.MemLimitMi
		totalMemPerc += s.MemPercVal
		totalNetRx += s.NetRxMi
		totalNetTx += s.NetTxMi
		totalBlkRead += s.BlkReadMi
		totalBlkWrite += s.BlkWriteMi
		totalPIDs += s.PIDsVal
	}

	fmt.Println(strings.Repeat("-", len(header)))
	fmt.Printf("%-25s %-12s %-18s %-18s %-18s %-10s %-18s %-18s\n",
		"TOTAL",
		fmt.Sprintf("%.2f%%", totalCPU),
		formatSizeMiB(totalMemUsage),
		formatSizeMiB(totalMemLimit),
		fmt.Sprintf("%.2f%%", totalMemPerc),
		fmt.Sprintf("%s / %s", formatSizeMiB(totalNetRx), formatSizeMiB(totalNetTx)),
		fmt.Sprintf("%s / %s", formatSizeMiB(totalBlkRead), formatSizeMiB(totalBlkWrite)),
		fmt.Sprintf("%d", totalPIDs))

	if hostMem, err := getHostMemory(); err == nil && hostMem > 0 {
		usedPercent := (totalMemUsage / hostMem) * 100
		fmt.Println()
		fmt.Printf("Host RAM: %s total\n", formatSizeMiB(hostMem))
		fmt.Printf("Compose RAM Usage: %s (%.2f%% of host)\n", formatSizeMiB(totalMemUsage), usedPercent)
		predicted := totalMemUsage * 1.15
		fmt.Printf("Predicted (all services + 15%% overhead): %s\n", formatSizeMiB(predicted))
	}
}

func getHostMemory() (float64, error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, err
	}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				kb, err := strconv.ParseFloat(fields[1], 64)
				if err == nil {
					return kb / 1024, nil
				}
			}
		}
	}
	return 0, fmt.Errorf("MemTotal not found")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

func fatal(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
