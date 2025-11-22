package agents

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/logging"
)

// BaseAgent provides common functionality for all agents
type BaseAgent struct {
	config Config
}

// NewBaseAgent creates a new base agent with the given configuration
func NewBaseAgent(cfg Config) *BaseAgent {
	return &BaseAgent{
		config: cfg,
	}
}

// Name returns the agent's name
func (a *BaseAgent) Name() string {
	return a.config.Name
}

// IsAvailable checks if the agent's CLI is available
func (a *BaseAgent) IsAvailable() bool {
	_, err := exec.LookPath(a.config.CLIPath)
	return err == nil
}

// ExecuteCommand runs a command with timeout and returns stdout
func (a *BaseAgent) ExecuteCommand(ctx context.Context, args []string, stdin string) (string, error) {
	// Log the command being executed
	logging.Command(a.config.Name, a.config.CLIPath, args)
	if stdin != "" {
		logging.Debug("%s: stdin length: %d bytes", a.config.Name, len(stdin))

		// Save stdin to temp file for debugging
		stdinFile := logging.SaveStdinToTempFile(a.config.Name, stdin)
		if stdinFile != "" {
			logging.Info("%s: Test this command: cat %s | %s %v", a.config.Name, stdinFile, a.config.CLIPath, args)
		}
	}

	// Create context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, a.config.Timeout)
	defer cancel()

	// Build command
	cmd := exec.CommandContext(timeoutCtx, a.config.CLIPath, args...)

	// Setup stdin if provided
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	// Capture stdout and stderr
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Execute
	startTime := time.Now()
	err := cmd.Run()
	duration := time.Since(startTime)

	// Log the output
	logging.Output(a.config.Name, stdout.String(), stderr.String())
	logging.Info("%s: command completed in %v", a.config.Name, duration)

	// Check for timeout
	if timeoutCtx.Err() == context.DeadlineExceeded {
		logging.Error("%s: command timed out after %v", a.config.Name, a.config.Timeout)
		return "", fmt.Errorf("command timed out after %v", a.config.Timeout)
	}

	// Check for other errors
	if err != nil {
		if stderr.Len() > 0 {
			logging.Error("%s: command failed with stderr: %s", a.config.Name, stderr.String())
			return "", fmt.Errorf("command failed: %w\nstderr: %s", err, stderr.String())
		}
		logging.Error("%s: command failed: %v", a.config.Name, err)
		return "", fmt.Errorf("command failed: %w", err)
	}

	// Log duration for debugging
	if duration > a.config.Timeout/2 {
		// Warning: command took more than half the timeout
		logging.Info("%s: command took %v (timeout: %v)", a.config.Name, duration, a.config.Timeout)
		fmt.Printf("Warning: %s command took %v (timeout: %v)\n", a.config.Name, duration, a.config.Timeout)
	}

	return stdout.String(), nil
}

// Config returns the agent's configuration
func (a *BaseAgent) Config() Config {
	return a.config
}
