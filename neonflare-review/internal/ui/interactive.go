package ui

import (
	"context"
	"fmt"
	"os/exec"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/output"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/prompts"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/ui/screens"
)

// InteractiveMode represents the interactive TUI flow
type InteractiveMode struct {
	ctx             context.Context
	config          *config.Config
	orchestrator    *review.Orchestrator
	code            string
	userPrompt      string
	metadata        map[string]string
	currentScreen   tea.Model
	selectedAgents  []string
	selectedProfile string // Selected prompt profile name ("" for default)
	profileManager  *prompts.ProfileManager
	outputFiles     []string
	done            bool
	err             error
	width           int
	height          int
	startReview     bool // Flag to indicate review should start
}

// NewInteractiveMode creates a new interactive mode session
func NewInteractiveMode(ctx context.Context, cfg *config.Config, orch *review.Orchestrator, code string, userPrompt string, metadata map[string]string) *InteractiveMode {
	// Initialize profile manager
	pm, err := prompts.NewProfileManager()
	if err != nil {
		fmt.Printf("Warning: failed to initialize prompt profiles: %v\n", err)
		// Continue without profiles
	}

	return &InteractiveMode{
		ctx:            ctx,
		config:         cfg,
		orchestrator:   orch,
		code:           code,
		userPrompt:     userPrompt,
		metadata:       metadata,
		currentScreen:  screens.NewWelcomeModel(),
		profileManager: pm,
		done:           false,
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
				// Quick start: select 2 preferred agents, go straight to confirmation
				im.selectedAgents = im.getTwoRandomAgents()
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
			// Store selected agents and go to prompt selection
			im.selectedAgents = screen.SelectedAgents()

			// Check if we have any profiles available
			if im.profileManager != nil && im.profileManager.HasProfiles() {
				// Show prompt selector
				profileNames := im.profileManager.GetProfileNames()
				im.currentScreen = screens.NewPromptSelectorModel(profileNames)
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()
			}

			// No profiles - go straight to confirmation with default prompt
			im.selectedProfile = ""
			im.currentScreen = screens.NewConfirmationModel(
				im.config,
				im.selectedAgents,
				im.getInputSourceDescription(),
				im.userPrompt,
			)
			im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
			return im, im.currentScreen.Init()
		}

	case screens.PromptSelectorModel:
		if screen.Done() {
			if screen.Cancelled() {
				// Go back to agent selection
				im.currentScreen = screens.NewAgentSelectorModel(im.getAllAgentNames())
				im.currentScreen, _ = im.currentScreen.Update(tea.WindowSizeMsg{Width: im.width, Height: im.height})
				return im, im.currentScreen.Init()
			}
			// Store selected profile and go to confirmation
			im.selectedProfile = screen.SelectedProfile()
			im.currentScreen = screens.NewConfirmationModelWithProfile(
				im.config,
				im.selectedAgents,
				im.selectedProfile,
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

// getTwoRandomAgents returns 2 random agents from the available list
// Prefers kilocode and claude over codex (as per selector preference)
func (im *InteractiveMode) getTwoRandomAgents() []string {
	available := im.config.GetEnabledAgents()
	if len(available) == 0 {
		return []string{}
	}

	// Preferred order: kilocode, claude, codex
	preferredOrder := []string{"kilocode", "claude", "codex"}

	// Build list of available agents in preferred order
	orderedAvailable := []string{}
	for _, preferred := range preferredOrder {
		for _, agent := range available {
			if agent == preferred {
				orderedAvailable = append(orderedAvailable, agent)
				break
			}
		}
	}

	// If we have 2 or more agents, return the first 2 (most preferred)
	if len(orderedAvailable) >= 2 {
		return []string{orderedAvailable[0], orderedAvailable[1]}
	}

	// If we only have 1 agent, use it twice
	if len(orderedAvailable) == 1 {
		return []string{orderedAvailable[0], orderedAvailable[0]}
	}

	return orderedAvailable
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
	// Ensure terminal is restored on exit
	defer func() {
		// Explicitly reset terminal to normal state
		// This handles cases where Bubbletea's cleanup might not run
		fmt.Print("\033[?25h")  // Show cursor
		fmt.Print("\033[0m")    // Reset colors/styles
		fmt.Print("\r\n")       // Newline
	}()

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
		result, err := RunWithUI(ctx, orch, code, userPrompt, im.selectedAgents, cfg, metadata, im.profileManager, im.selectedProfile)
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
		fmt.Printf("Saved %s review to: %s\n\n", result.Reviewer2, file2)
	}

	return nil
}
