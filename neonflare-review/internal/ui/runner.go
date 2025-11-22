package ui

import (
	"context"
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
)

// RunWithUI executes a review with the Bubbletea UI
func RunWithUI(ctx context.Context, orch *review.Orchestrator, code string, userPrompt string, specifiedAgents []string, cfg *config.Config, metadata map[string]string) (*review.Result, error) {
	// Select agents first
	available := cfg.GetEnabledAgents()
	reviewer1Name, reviewer2Name, err := review.SelectAgents(available, specifiedAgents)
	if err != nil {
		return nil, fmt.Errorf("failed to select agents: %w", err)
	}

	// Create UI model (no aggregator)
	model := NewModel(reviewer1Name, reviewer2Name, "", metadata)

	// Create the Bubbletea program
	p := tea.NewProgram(model, tea.WithAltScreen())

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

		result, err := orch.RunReviewWithCallback(ctx, code, userPrompt, []string{reviewer1Name, reviewer2Name}, callback)
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
		if m, ok := finalModel.(Model); ok && m.err != nil {
			return nil, m.err
		}
		return result, nil
	default:
		return nil, fmt.Errorf("review did not complete")
	}
}
