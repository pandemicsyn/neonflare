package ui

import (
	"context"
	"fmt"
	"os/exec"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/output"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/ui/screens"
)

// InteractiveMode represents the interactive TUI flow
type InteractiveMode struct {
	ctx            context.Context
	config         *config.Config
	orchestrator   *review.Orchestrator
	code           string
	userPrompt     string
	metadata       map[string]string
	currentScreen  tea.Model
	selectedAgents []string
	outputFiles    []string
	done           bool
	err            error
}

// NewInteractiveMode creates a new interactive mode session
func NewInteractiveMode(ctx context.Context, cfg *config.Config, orch *review.Orchestrator, code string, userPrompt string, metadata map[string]string) *InteractiveMode {
	return &InteractiveMode{
		ctx:          ctx,
		config:       cfg,
		orchestrator: orch,
		code:         code,
		userPrompt:   userPrompt,
		metadata:     metadata,
		currentScreen: screens.NewWelcomeModel(),
		done:         false,
	}
}

// Init initializes the interactive mode
func (im *InteractiveMode) Init() tea.Cmd {
	return im.currentScreen.Init()
}

// Update handles messages for the interactive mode
func (im *InteractiveMode) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Update the current screen
	var cmd tea.Cmd
	im.currentScreen, cmd = im.currentScreen.Update(msg)

	// Check if current screen is done and transition to next screen
	switch screen := im.currentScreen.(type) {
	case screens.WelcomeModel:
		if screen.Done() {
			switch screen.Selected() {
			case screens.ChoiceQuickStart:
				// Quick start: use all agents, go straight to confirmation
				im.selectedAgents = im.getAllAgentNames()
				im.currentScreen = screens.NewConfirmationModel(
					im.config,
					im.selectedAgents,
					im.getInputSourceDescription(),
					im.userPrompt,
				)
				return im, im.currentScreen.Init()

			case screens.ChoiceCustomReview:
				// Custom review: go to agent selection
				im.currentScreen = screens.NewAgentSelectorModel(im.getAllAgentNames())
				return im, im.currentScreen.Init()

			case screens.ChoiceSettings:
				// Settings: go to config editor
				im.currentScreen = screens.NewConfigEditorModel(im.config)
				return im, im.currentScreen.Init()

			case screens.ChoiceQuit:
				im.done = true
				return im, tea.Quit
			}
		}

	case screens.AgentSelectorModel:
		if screen.Done() {
			if screen.Cancelled() {
				// Go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				return im, im.currentScreen.Init()
			}
			// Store selected agents and go to confirmation
			im.selectedAgents = screen.SelectedAgents()
			im.currentScreen = screens.NewConfirmationModel(
				im.config,
				im.selectedAgents,
				im.getInputSourceDescription(),
				im.userPrompt,
			)
			return im, im.currentScreen.Init()
		}

	case screens.ConfigEditorModel:
		if screen.Done() {
			if screen.Cancelled() {
				// Go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				return im, im.currentScreen.Init()
			}
			// Config updated, go back to welcome
			im.config = screen.Config()
			im.currentScreen = screens.NewWelcomeModel()
			return im, im.currentScreen.Init()
		}

	case screens.ConfirmationModel:
		if screen.Done() {
			if screen.Cancelled() {
				// Go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				return im, im.currentScreen.Init()
			}
			if screen.Confirmed() {
				// Start the review with the existing UI
				return im, im.startReview()
			}
		}

	case screens.PostReviewModel:
		if screen.Done() {
			switch screen.Selected() {
			case screens.ActionViewReviews:
				// View reviews (already shown in previous screen)
				// Go back to post-review menu
				im.currentScreen = screens.NewPostReviewModel(im.outputFiles)
				return im, im.currentScreen.Init()

			case screens.ActionOpenFiles:
				// Open files with default editor
				im.openReviewFiles(screen.OutputFiles())
				// Go back to post-review menu
				im.currentScreen = screens.NewPostReviewModel(im.outputFiles)
				return im, im.currentScreen.Init()

			case screens.ActionNewReview:
				// Start a new review - go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				return im, im.currentScreen.Init()

			case screens.ActionExit:
				im.done = true
				return im, tea.Quit
			}
		}
	}

	return im, cmd
}

// View renders the current screen
func (im *InteractiveMode) View() string {
	return im.currentScreen.View()
}

// startReview initiates the review process
func (im *InteractiveMode) startReview() tea.Cmd {
	return func() tea.Msg {
		// Run the review with UI
		result, err := RunWithUI(
			im.ctx,
			im.orchestrator,
			im.code,
			im.userPrompt,
			im.selectedAgents,
			im.config,
			im.metadata,
		)

		if err != nil {
			im.err = err
			return nil
		}

		// Save reviews to files
		writer := output.NewWriter(im.config.Output.Dir, im.config.Output.Timestamp)

		file1, err := writer.SaveReview(result.Review1, im.metadata)
		if err != nil {
			im.err = fmt.Errorf("failed to save review 1: %w", err)
			return nil
		}

		file2, err := writer.SaveReview(result.Review2, im.metadata)
		if err != nil {
			im.err = fmt.Errorf("failed to save review 2: %w", err)
			return nil
		}

		fileAgg, err := writer.SaveAggregateReview(result.AggregateReview, im.metadata, result.Reviewer1, result.Reviewer2)
		if err != nil {
			im.err = fmt.Errorf("failed to save aggregate review: %w", err)
			return nil
		}

		// Save the output files
		im.outputFiles = []string{
			file1,
			file2,
			fileAgg,
		}

		// Transition to post-review menu
		im.currentScreen = screens.NewPostReviewModel(im.outputFiles)
		return im.currentScreen.Init()
	}
}

// getAllAgentNames returns all available agent names
func (im *InteractiveMode) getAllAgentNames() []string {
	return im.config.GetEnabledAgents()
}

// getInputSourceDescription returns a human-readable description of the input source
func (im *InteractiveMode) getInputSourceDescription() string {
	if repo, ok := im.metadata["repository"]; ok && repo != "" {
		if commit, ok := im.metadata["commit"]; ok && commit != "" && len(commit) >= 8 {
			return fmt.Sprintf("Git: %s (commit: %s)", repo, commit[:8])
		}
		return fmt.Sprintf("Git: %s", repo)
	}
	return "stdin"
}

// openReviewFiles attempts to open the review files with the default editor
func (im *InteractiveMode) openReviewFiles(files []string) {
	editor := "less" // fallback to less as a pager

	// Try common editors
	for _, e := range []string{"$EDITOR", "vim", "nano", "cat"} {
		if e == "$EDITOR" {
			// Check environment variable
			continue
		}
		if _, err := exec.LookPath(e); err == nil {
			editor = e
			break
		}
	}

	for _, file := range files {
		cmd := exec.Command(editor, file)
		cmd.Run()
	}
}

// RunInteractive starts the interactive mode
func RunInteractive(ctx context.Context, cfg *config.Config, orch *review.Orchestrator, code string, userPrompt string, metadata map[string]string) error {
	im := NewInteractiveMode(ctx, cfg, orch, code, userPrompt, metadata)

	p := tea.NewProgram(im, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		return fmt.Errorf("error running interactive mode: %w", err)
	}

	if im.err != nil {
		return im.err
	}

	return nil
}
