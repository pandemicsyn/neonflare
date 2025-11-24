package ui

import (
	"context"
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/output"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/prompts"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
)

// RunWithUI executes a review with the Bubbletea UI
func RunWithUI(ctx context.Context, orch *review.Orchestrator, code string, userPrompt string, specifiedAgents []string, cfg *config.Config, metadata map[string]string, pm *prompts.ProfileManager, selectedProfile string) (*review.Result, error) {
	// Ensure terminal is restored on exit
	defer func() {
		// Explicitly reset terminal to normal state
		// This handles cases where Bubbletea's cleanup might not run
		fmt.Print("\033[?25h")  // Show cursor
		fmt.Print("\033[0m")    // Reset colors/styles
		fmt.Print("\r\n")       // Newline
	}()

	// Select agents first
	available := cfg.GetEnabledAgents()
	reviewer1Name, reviewer2Name, err := review.SelectAgents(available, specifiedAgents)
	if err != nil {
		return nil, fmt.Errorf("failed to select agents: %w", err)
	}

	// Create UI model with available agents for aggregation
	model := NewModelWithAgents(ctx, orch, reviewer1Name, reviewer2Name, metadata, available)

	// Create the Bubbletea program
	p := tea.NewProgram(model, tea.WithAltScreen())

	// Build effective user prompt based on selected profile
	effectivePrompt := userPrompt
	if selectedProfile != "" && pm != nil {
		profile := pm.GetProfile(selectedProfile)
		if profile != nil {
			// Prepend profile content to user prompt
			if userPrompt != "" {
				effectivePrompt = profile.Content + "\n\nAdditional instructions:\n" + userPrompt
			} else {
				effectivePrompt = profile.Content
			}
		}
	}

	// Run the review in a goroutine and send updates to the UI
	resultChan := make(chan *review.Result, 1)
	errorChan := make(chan error, 1)

	go func() {
		// Create progress callback to send updates to UI
		callback := func(event review.ProgressEvent) {
			switch event.Type {
			case "reviewer_start":
				p.Send(ReviewUpdateMsg{
					ReviewerNum: event.Reviewer,
					Content:     fmt.Sprintf("Starting %s review...\n", event.AgentName),
					Done:        false,
				})
			case "reviewer_output":
				// Stream output as it arrives
				p.Send(ReviewUpdateMsg{
					ReviewerNum: event.Reviewer,
					Content:     event.Content,
					Done:        false,
				})
			case "reviewer_done":
				if event.Review.Error != nil {
					p.Send(ReviewUpdateMsg{
						ReviewerNum: event.Reviewer,
						Content:     fmt.Sprintf("Error: %v\n", event.Review.Error),
						Done:        true,
					})
				} else {
					// Don't send content here - it was already streamed
					p.Send(ReviewUpdateMsg{
						ReviewerNum: event.Reviewer,
						Content:     "",
						Done:        true,
					})
				}
			}
		}

		result, err := orch.RunReviewWithCallback(ctx, code, effectivePrompt, []string{reviewer1Name, reviewer2Name}, callback)
		if err != nil {
			errorChan <- err
			return
		}
		resultChan <- result

		// Send completion message to UI
		p.Send(ReviewCompleteMsg{
			Review1: result.Review1,
			Review2: result.Review2,
		})

		// Wait for aggregation trigger (if user presses 's')
		// This will be handled by listening to the program's messages
	}()

	// Start the UI
	finalModel, err := p.Run()
	if err != nil {
		return nil, fmt.Errorf("UI error: %w", err)
	}

	// Check for errors from review
	select {
	case err := <-errorChan:
		return nil, err
	case result := <-resultChan:
		// Verify the model is in the correct state
		if m, ok := finalModel.(Model); ok {
			if m.err != nil {
				return nil, m.err
			}

			// Save aggregation if it was done
			if m.aggregationDone && m.aggregationContent != "" {
				writer := output.NewWriter(cfg.Output.Dir, cfg.Output.Timestamp)
				aggregationPath, err := writer.SaveAggregation(
					m.aggregatorName,
					m.aggregationContent,
					metadata,
					reviewer1Name,
					reviewer2Name,
				)
				if err != nil {
					fmt.Printf("\n⚠️  Failed to save aggregation: %v\n", err)
				} else {
					fmt.Printf("\n✅ Saved aggregated review to: %s\n", aggregationPath)
				}
			}
		}
		return result, nil
	default:
		return nil, fmt.Errorf("review did not complete")
	}
}

// RunAggregation runs the aggregation flow within an existing UI model
// This is called when the user presses 's' to aggregate reviews
// Note: This function is deprecated as aggregation is now handled directly in the Model's Update loop
func RunAggregation(ctx context.Context, model Model, orch *review.Orchestrator, cfg *config.Config, p *tea.Program) (Model, error) {
	// Aggregation is now handled directly in the Model's Update loop
	// This function is kept for compatibility but is no longer used
	return model, nil
}

// ExecuteAggregation executes the aggregation with a selected agent
func ExecuteAggregation(ctx context.Context, agentName string, review1Content string, review2Content string, orch *review.Orchestrator, metadata map[string]string, p *tea.Program) (string, error) {
	// Build aggregation prompt
	aggregationPrompt := `Please review, validate, and aggregate these two independently performed code reviews for this repo/branch/changes.

Prioritize issues based on severity. Output should be markdown formatted and fairly terse. Praise is not required, stick to relevant details and actionable info.

## Review 1
` + review1Content + `

## Review 2
` + review2Content

	// Get the agent
	agent := orch.GetAgent(agentName)
	if agent == nil {
		return "", fmt.Errorf("agent %s not found", agentName)
	}

	// Create output callback
	outputCallback := func(chunk string) {
		if p != nil {
			p.Send(AggregationUpdateMsg{
				Content: chunk,
				Done:    false,
			})
		}
	}

	// Execute aggregation with streaming
	var output string
	var err error

	switch a := agent.(type) {
	case *agents.ClaudeAgent:
		output, err = a.ExecuteWithCallback(ctx, aggregationPrompt, "", outputCallback)
	case *agents.KilocodeAgent:
		output, err = a.ExecuteWithCallback(ctx, aggregationPrompt, "", outputCallback)
	case *agents.CodexAgent:
		output, err = a.ExecuteWithCallback(ctx, aggregationPrompt, "", outputCallback)
	default:
		output, err = agent.Execute(ctx, aggregationPrompt, "")
	}

	if err != nil {
		return "", fmt.Errorf("aggregation failed: %w", err)
	}

	return output, nil
}
