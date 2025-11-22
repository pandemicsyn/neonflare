package agents

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"time"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/logging"
)

// OutputCallback is called with chunks of output as they arrive
type OutputCallback func(chunk string)

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
// If outputCallback is provided, it will be called with chunks of output as they arrive
func (a *BaseAgent) ExecuteCommand(ctx context.Context, args []string, stdin string, outputCallback OutputCallback) (string, error) {
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

	// Setup stdout pipe for streaming
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	// Capture stderr
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	// Start command
	startTime := time.Now()
	if err := cmd.Start(); err != nil {
		logging.Error("%s: failed to start command: %v", a.config.Name, err)
		return "", fmt.Errorf("failed to start command: %w", err)
	}

	// Stream output in real-time
	var stdout strings.Builder
	reader := bufio.NewReader(stdoutPipe)

	// Read output line by line
	done := make(chan error, 1)
	go func() {
		for {
			line, err := reader.ReadString('\n')
			if len(line) > 0 {
				stdout.WriteString(line)
				// Call callback with this chunk of output
				if outputCallback != nil {
					outputCallback(line)
				}
			}
			if err != nil {
				if err != io.EOF {
					done <- err
				} else {
					done <- nil
				}
				return
			}
		}
	}()

	// Wait for either command completion or timeout
	waitErr := make(chan error, 1)
	go func() {
		waitErr <- cmd.Wait()
	}()

	// Wait for streaming to complete
	streamErr := <-done

	// Wait for command to complete
	err = <-waitErr
	duration := time.Since(startTime)

	// Get final output
	output := stdout.String()

	// Log the output
	logging.Output(a.config.Name, output, stderr.String())
	logging.Info("%s: command completed in %v", a.config.Name, duration)

	// Check for timeout
	if timeoutCtx.Err() == context.DeadlineExceeded {
		logging.Error("%s: command timed out after %v", a.config.Name, a.config.Timeout)
		return output, fmt.Errorf("command timed out after %v", a.config.Timeout)
	}

	// Check for streaming error
	if streamErr != nil && streamErr != io.EOF {
		logging.Error("%s: error reading output: %v", a.config.Name, streamErr)
		return output, fmt.Errorf("error reading output: %w", streamErr)
	}

	// Check for other errors
	if err != nil {
		if stderr.Len() > 0 {
			logging.Error("%s: command failed with stderr: %s", a.config.Name, stderr.String())
			return output, fmt.Errorf("command failed: %w\nstderr: %s", err, stderr.String())
		}
		logging.Error("%s: command failed: %v", a.config.Name, err)
		return output, fmt.Errorf("command failed: %w", err)
	}

	// Log duration for debugging
	if duration > a.config.Timeout/2 {
		// Warning: command took more than half the timeout
		logging.Info("%s: command took %v (timeout: %v)", a.config.Name, duration, a.config.Timeout)
		fmt.Printf("Warning: %s command took %v (timeout: %v)\n", a.config.Name, duration, a.config.Timeout)
	}

	return output, nil
}

// Config returns the agent's configuration
func (a *BaseAgent) Config() Config {
	return a.config
}
