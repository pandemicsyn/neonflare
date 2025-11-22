package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	logger     *log.Logger
	logFile    *os.File
	loggerOnce sync.Once
)

// Init initializes the logger with a file in the specified directory
func Init(logDir string) error {
	var initErr error
	loggerOnce.Do(func() {
		// Create log directory if it doesn't exist
		if err := os.MkdirAll(logDir, 0755); err != nil {
			initErr = fmt.Errorf("failed to create log directory: %w", err)
			return
		}

		// Create log file with timestamp
		timestamp := time.Now().Format("2006-01-02_150405")
		logPath := filepath.Join(logDir, fmt.Sprintf("neonflare-review_%s.log", timestamp))

		file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			initErr = fmt.Errorf("failed to open log file: %w", err)
			return
		}

		logFile = file

		// Log to both file and stdout for debugging
		multiWriter := io.MultiWriter(file)
		logger = log.New(multiWriter, "", log.LstdFlags|log.Lshortfile)

		logger.Printf("=== Neonflare Review Log Started ===")
		logger.Printf("Log file: %s", logPath)
		fmt.Fprintf(os.Stderr, "Debug log: %s\n", logPath)
	})

	return initErr
}

// Close closes the log file
func Close() {
	if logFile != nil {
		logger.Println("=== Neonflare Review Log Ended ===")
		logFile.Close()
	}
}

// Debug logs a debug message
func Debug(format string, v ...interface{}) {
	if logger != nil {
		logger.Printf("[DEBUG] "+format, v...)
	}
}

// Info logs an info message
func Info(format string, v ...interface{}) {
	if logger != nil {
		logger.Printf("[INFO] "+format, v...)
	}
}

// Error logs an error message
func Error(format string, v ...interface{}) {
	if logger != nil {
		logger.Printf("[ERROR] "+format, v...)
	}
}

// Command logs a command execution
func Command(name, cmd string, args []string) {
	if logger != nil {
		logger.Printf("[CMD] %s: %s %v", name, cmd, args)

		// Also log an example invocation that can be copy-pasted
		// Build the command string
		cmdStr := cmd
		for _, arg := range args {
			// Quote args that contain spaces
			if len(arg) > 0 && (arg[0] == '-' || !hasSpace(arg)) {
				cmdStr += " " + arg
			} else {
				cmdStr += " \"" + arg + "\""
			}
		}
		logger.Printf("[CMD] Example: echo '<stdin>' | %s", cmdStr)
	}
}

// hasSpace checks if a string contains spaces
func hasSpace(s string) bool {
	for _, r := range s {
		if r == ' ' {
			return true
		}
	}
	return false
}

// SaveStdinToTempFile saves stdin content to a temp file for debugging
func SaveStdinToTempFile(agentName, stdin string) string {
	if logger == nil || stdin == "" {
		return ""
	}

	// Create temp file in the same directory as the log
	if logFile == nil {
		return ""
	}

	// Get log directory
	logDir := filepath.Dir(logFile.Name())
	tempFile := filepath.Join(logDir, fmt.Sprintf("%s_stdin.txt", agentName))

	// Write stdin to file
	if err := os.WriteFile(tempFile, []byte(stdin), 0644); err != nil {
		logger.Printf("[ERROR] Failed to save stdin to temp file: %v", err)
		return ""
	}

	logger.Printf("[DEBUG] Saved stdin to: %s", tempFile)
	return tempFile
}

// Output logs command output
func Output(name string, stdout, stderr string) {
	if logger != nil {
		if stdout != "" {
			logger.Printf("[STDOUT] %s:\n%s", name, stdout)
		}
		if stderr != "" {
			logger.Printf("[STDERR] %s:\n%s", name, stderr)
		}
	}
}
