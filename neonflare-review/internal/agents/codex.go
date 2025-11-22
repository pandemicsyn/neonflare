package agents

import (
	"context"
	"fmt"
)

// CodexAgent implements the Agent interface for OpenAI Codex
type CodexAgent struct {
	*BaseAgent
}

// NewCodexAgent creates a new Codex agent
func NewCodexAgent(cfg Config) *CodexAgent {
	return &CodexAgent{
		BaseAgent: NewBaseAgent(cfg),
	}
}

// Execute runs Codex with the given prompt and input
func (a *CodexAgent) Execute(ctx context.Context, prompt string, input string) (string, error) {
	return a.ExecuteWithCallback(ctx, prompt, input, nil)
}

// ExecuteWithCallback runs Codex with streaming output support
func (a *CodexAgent) ExecuteWithCallback(ctx context.Context, prompt string, input string, outputCallback OutputCallback) (string, error) {
	// If input is provided (legacy mode), append it to prompt
	// Otherwise, assume prompt contains file-based instructions
	var fullPrompt string
	if input != "" {
		fullPrompt = fmt.Sprintf("%s\n\nCode to review:\n%s", prompt, input)
	} else {
		fullPrompt = prompt
	}

	// Use codex exec for non-interactive execution
	// Pass prompt via stdin to avoid command-line length limits
	args := []string{
		"exec",
		"-m", a.config.Model,
		"--dangerously-bypass-approvals-and-sandbox", // For autonomous execution
	}

	// Execute the command with prompt via stdin
	output, err := a.ExecuteCommand(ctx, args, fullPrompt, outputCallback)
	if err != nil {
		return "", fmt.Errorf("codex execution failed: %w", err)
	}

	return output, nil
}
