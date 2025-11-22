package agents

import (
	"context"
	"fmt"
)

// KilocodeAgent implements the Agent interface for Kilocode
type KilocodeAgent struct {
	*BaseAgent
}

// NewKilocodeAgent creates a new Kilocode agent
func NewKilocodeAgent(cfg Config) *KilocodeAgent {
	return &KilocodeAgent{
		BaseAgent: NewBaseAgent(cfg),
	}
}

// Execute runs Kilocode with the given prompt and input
func (a *KilocodeAgent) Execute(ctx context.Context, prompt string, input string) (string, error) {
	// Build the full prompt with code to review
	fullPrompt := fmt.Sprintf("%s\n\nCode to review:\n%s", prompt, input)

	// Use kilocode --auto for non-interactive execution
	// Format: kilocode --auto --mode <mode> --json <prompt>
	args := []string{
		"--auto",
		"--mode", "code", // Use code mode for code review
		"--json", // Get JSON output for easier parsing
		fullPrompt,
	}

	// Execute the command
	output, err := a.ExecuteCommand(ctx, args, "")
	if err != nil {
		return "", fmt.Errorf("kilocode execution failed: %w", err)
	}

	return output, nil
}
