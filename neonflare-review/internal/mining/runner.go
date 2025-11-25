package mining

import (
	"context"
	"fmt"
	"time"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
)

// MiningResult contains the result of a rules mining operation
type MiningResult struct {
	AgentName     string
	Content       string
	Duration      time.Duration
	Error         error
	Repository    string
	PRCount       int
	PatternCount  int // Number of patterns found (if we can extract it)
}

// RunMining executes the rules mining operation using the specified agent
func RunMining(ctx context.Context, orch *review.Orchestrator, agentName string, prompt string, callback agents.OutputCallback) (*MiningResult, error) {
	startTime := time.Now()

	result := &MiningResult{
		AgentName: agentName,
	}

	// Get the specified agent
	agent := orch.GetAgent(agentName)
	if agent == nil {
		return nil, fmt.Errorf("agent %s not found or not registered", agentName)
	}

	// Check if agent is available
	if !agent.IsAvailable() {
		return nil, fmt.Errorf("agent %s is not available (check API keys/configuration)", agentName)
	}

	fmt.Printf("⏳ Starting rules mining with %s...\n", agentName)
	fmt.Printf("   This may take a few minutes as the agent fetches and analyzes PR data...\n\n")

	// Execute the mining prompt
	var output string
	var err error

	// Use type assertion to check if agent has ExecuteWithCallback
	switch a := agent.(type) {
	case *agents.ClaudeAgent:
		output, err = a.ExecuteWithCallback(ctx, prompt, "", callback)
	case *agents.KilocodeAgent:
		output, err = a.ExecuteWithCallback(ctx, prompt, "", callback)
	case *agents.CodexAgent:
		output, err = a.ExecuteWithCallback(ctx, prompt, "", callback)
	default:
		// Fallback to regular Execute if streaming not supported
		output, err = agent.Execute(ctx, prompt, "")
	}

	result.Duration = time.Since(startTime)

	if err != nil {
		result.Error = err
		fmt.Printf("\n❌ Rules mining failed after %v: %v\n", result.Duration, err)
		return result, err
	}

	result.Content = output

	fmt.Printf("\n✅ Rules mining completed in %v\n", result.Duration)
	fmt.Printf("   Generated %d bytes of rules content\n", len(output))

	return result, nil
}

// RunMiningQuiet executes rules mining without progress output
func RunMiningQuiet(ctx context.Context, orch *review.Orchestrator, agentName string, prompt string) (*MiningResult, error) {
	return RunMining(ctx, orch, agentName, prompt, nil)
}
