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
	width          int
	height         int
	startReview    bool // Flag to indicate review should start
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
	// Handle window size messages
	if msg, ok := msg.(tea.WindowSizeMsg); ok {
		im.width = msg.Width
		im.height = msg.Height
	}

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
				// Send window size to new screen
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()

			case screens.ChoiceCustomReview:
				// Custom review: go to agent selection
				im.currentScreen = screens.NewAgentSelectorModel(im.getAllAgentNames())
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()

			case screens.ChoiceSettings:
				// Settings: go to config editor
				im.currentScreen = screens.NewConfigEditorModel(im.config)
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
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
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
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
			im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
			return im, im.currentScreen.Init()
		}

	case screens.ConfigEditorModel:
		if screen.Done() {
			if screen.Cancelled() {
				// Go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()
			}
			// Config updated, go back to welcome
			im.config = screen.Config()
			im.currentScreen = screens.NewWelcomeModel()
			im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
			return im, im.currentScreen.Init()
		}

	case screens.ConfirmationModel:
		if screen.Done() {
			if screen.Cancelled() {
				// Go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()
			}
			if screen.Confirmed() {
				// Set flag to start review and exit interactive mode
				im.startReview = true
				im.done = true
				return im, tea.Quit
			}
		}

	case screens.PostReviewModel:
		if screen.Done() {
			switch screen.Selected() {
			case screens.ActionViewReviews:
				// View reviews (already shown in previous screen)
				// Go back to post-review menu
				im.currentScreen = screens.NewPostReviewModel(im.outputFiles)
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()

			case screens.ActionOpenFiles:
				// Open files with default editor
				im.openReviewFiles(screen.OutputFiles())
				// Go back to post-review menu
				im.currentScreen = screens.NewPostReviewModel(im.outputFiles)
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()

			case screens.ActionNewReview:
				// Start a new review - go back to welcome
				im.currentScreen = screens.NewWelcomeModel()
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
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

	// If user confirmed to start review, run it now
	if im.startReview {
		fmt.Println("\n🚀 Starting review with split-screen UI...\n")

		// Run the review with the split-screen UI
		result, err := RunWithUI(ctx, orch, code, userPrompt, im.selectedAgents, cfg, metadata)
		if err != nil {
			return fmt.Errorf("review failed: %w", err)
		}

		// Save reviews to files
		writer := output.NewWriter(cfg.Output.Dir, cfg.Output.Timestamp)

		file1, err := writer.SaveReview(result.Review1, metadata)
		if err != nil {
			return fmt.Errorf("failed to save review 1: %w", err)
		}
		fmt.Printf("\nSaved %s review to: %s\n", result.Reviewer1, file1)

		file2, err := writer.SaveReview(result.Review2, metadata)
		if err != nil {
			return fmt.Errorf("failed to save review 2: %w", err)
		}
		fmt.Printf("Saved %s review to: %s\n", result.Reviewer2, file2)

		fileAgg, err := writer.SaveAggregateReview(result.AggregateReview, metadata, result.Reviewer1, result.Reviewer2)
		if err != nil {
			return fmt.Errorf("failed to save aggregate review: %w", err)
		}
		fmt.Printf("Saved aggregate review to: %s\n\n", fileAgg)
	}

	return nil
}
