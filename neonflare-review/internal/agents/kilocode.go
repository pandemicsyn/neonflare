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
	return a.ExecuteWithCallback(ctx, prompt, input, nil)
}

// ExecuteWithCallback runs Kilocode with streaming output support
func (a *KilocodeAgent) ExecuteWithCallback(ctx context.Context, prompt string, input string, outputCallback OutputCallback) (string, error) {
	// Build the full prompt with code to review
	fullPrompt := fmt.Sprintf("%s\n\nCode to review:\n%s", prompt, input)

	// Use kilocode --auto for non-interactive execution
	// Note: Removed --json flag as it produces excessive output
	args := []string{
		"--auto",
		"--mode", "code", // Use code mode for code review
		fullPrompt,
	}

	// Wrap the callback to strip ANSI escape sequences from streaming output
	// Kilocode emits terminal control characters even in one-shot mode
	var wrappedCallback OutputCallback
	if outputCallback != nil {
		wrappedCallback = func(chunk string) {
			cleaned := StripANSI(chunk)
			if len(cleaned) > 0 { // Only send non-empty chunks
				outputCallback(cleaned)
			}
		}
	}

	// Execute the command with ANSI-stripping callback
	output, err := a.ExecuteCommand(ctx, args, "", wrappedCallback)
	if err != nil {
		return "", fmt.Errorf("kilocode execution failed: %w", err)
	}

	// Strip ANSI from final output as well
	cleanOutput := StripANSI(output)
	return cleanOutput, nil
}
