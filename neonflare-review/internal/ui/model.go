package ui

import (
	"fmt"
	"time"

	"context"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/glamour"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/ui/screens"
)

// ViewMode represents the current UI state
type ViewMode int

const (
	ViewModeSplit               ViewMode = iota // Split view for parallel reviews
	ViewModeDone                                // Review complete
	ViewModeAggregatorSelector                  // Selecting agent for aggregation
	ViewModeAggregation                         // Aggregation in progress/complete
)

// Model represents the Bubbletea model for the review UI
type Model struct {
	// State
	mode          ViewMode
	width         int
	height        int
	ready         bool
	err           error
	ctx           context.Context
	orchestrator  *review.Orchestrator

	// Review data
	reviewer1Name    string
	reviewer2Name    string
	review1Content   string // Accumulated review content
	review2Content   string // Accumulated review content
	review1Done      bool
	review2Done      bool
	review1Progress  int // Seconds elapsed
	review2Progress  int // Seconds elapsed

	// Viewports for scrolling
	review1Viewport viewport.Model
	review2Viewport viewport.Model
	focusedPanel    int // 0 = left (review1), 1 = right (review2)

	// Markdown renderer
	markdownRenderer *glamour.TermRenderer

	// Results
	review1Result *agents.Review
	review2Result *agents.Review

	// Aggregation state
	aggregatorName      string
	aggregationContent  string
	aggregationViewport viewport.Model
	aggregationDone     bool
	aggregationProgress int
	aggregatorSelector  screens.AggregatorSelectorModel
	availableAgents     []string

	// Metadata
	metadata map[string]string
}

// ReviewUpdateMsg contains review content updates
type ReviewUpdateMsg struct {
	ReviewerNum int    // 1 or 2
	Content     string
	Done        bool
}

// ReviewCompleteMsg indicates all reviews are complete
type ReviewCompleteMsg struct {
	Review1 *agents.Review
	Review2 *agents.Review
}

// StartAggregationMsg triggers the aggregation selector
type StartAggregationMsg struct{}

// StartAggregationExecutionMsg triggers the actual aggregation execution
type StartAggregationExecutionMsg struct {
	AgentName string
}

// AggregationUpdateMsg contains aggregation content updates
type AggregationUpdateMsg struct {
	Content string
	Done    bool
}

// AggregationCompleteMsg indicates aggregation is complete
type AggregationCompleteMsg struct {
	Content string
}

// TickMsg is sent periodically to update progress
type TickMsg time.Time

// NewModel creates a new UI model
func NewModel(reviewer1, reviewer2, _ string, metadata map[string]string) Model {
	return NewModelWithAgents(nil, nil, reviewer1, reviewer2, metadata, []string{})
}

// NewModelWithAgents creates a new UI model with available agents for aggregation
func NewModelWithAgents(ctx context.Context, orch *review.Orchestrator, reviewer1, reviewer2 string, metadata map[string]string, availableAgents []string) Model {
	// Create viewports for scrolling (dimensions will be set on WindowSizeMsg)
	vp1 := viewport.New(80, 20)
	vp1.SetContent("Waiting for review to start...")

	vp2 := viewport.New(80, 20)
	vp2.SetContent("Waiting for review to start...")

	// Create viewport for aggregation
	vpAgg := viewport.New(80, 20)
	vpAgg.SetContent("Aggregation will appear here...")

	// Create Glamour markdown renderer with dark theme
	renderer, _ := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(80), // Will be updated on WindowSizeMsg
	)

	return Model{
		mode:                ViewModeSplit,
		reviewer1Name:       reviewer1,
		reviewer2Name:       reviewer2,
		metadata:            metadata,
		review1Viewport:     vp1,
		review2Viewport:     vp2,
		aggregationViewport: vpAgg,
		focusedPanel:        0, // Start with left panel focused
		markdownRenderer:    renderer,
		availableAgents:     availableAgents,
		ctx:                 ctx,
		orchestrator:        orch,
	}
}

// Init initializes the model
func (m Model) Init() tea.Cmd {
	return tickCmd()
}

// tickCmd sends a tick message every second
func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

// runAggregationCmd executes the aggregation in a goroutine
func (m Model) runAggregationCmd(agentName string) tea.Cmd {
	return func() tea.Msg {
		// Build aggregation prompt
		aggregationPrompt := `Please review, validate, and aggregate these two independently performed code reviews for this repo/branch/changes.

Prioritize issues based on severity. Output should be markdown formatted and fairly terse. Praise is not required, stick to relevant details and actionable info.

## Review 1
` + m.review1Content + `

## Review 2
` + m.review2Content

		// Get the agent
		agent := m.orchestrator.GetAgent(agentName)
		if agent == nil {
			return AggregationCompleteMsg{Content: fmt.Sprintf("Error: agent %s not found", agentName)}
		}

		// Create output callback that returns AggregationUpdateMsg
		outputCallback := func(chunk string) {
			// Note: This won't work directly - we need a different approach
			// For now, we'll just accumulate and send at the end
		}

		// Execute aggregation with streaming
		var output string
		var err error

		switch a := agent.(type) {
		case *agents.ClaudeAgent:
			output, err = a.ExecuteWithCallback(m.ctx, aggregationPrompt, "", outputCallback)
		case *agents.KilocodeAgent:
			output, err = a.ExecuteWithCallback(m.ctx, aggregationPrompt, "", outputCallback)
		case *agents.CodexAgent:
			output, err = a.ExecuteWithCallback(m.ctx, aggregationPrompt, "", outputCallback)
		default:
			output, err = agent.Execute(m.ctx, aggregationPrompt, "")
		}

		if err != nil {
			return AggregationCompleteMsg{Content: fmt.Sprintf("Error: %v", err)}
		}

		return AggregationCompleteMsg{Content: output}
	}
}

// Update handles messages
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

		// Resize viewports to fit split-screen layout
		halfWidth := (m.width - 4) / 2     // -4 for borders and padding
		contentHeight := m.height - 8       // Leave room for title, status, footer

		m.review1Viewport.Width = halfWidth - 4  // -4 for panel padding
		m.review1Viewport.Height = contentHeight - 3 // -3 for title and status

		m.review2Viewport.Width = halfWidth - 4
		m.review2Viewport.Height = contentHeight - 3

		// Resize aggregation viewport (full width)
		m.aggregationViewport.Width = m.width - 8 // Leave room for borders
		m.aggregationViewport.Height = contentHeight - 3

		// Update Glamour word wrap width to match viewport
		if m.markdownRenderer != nil {
			m.markdownRenderer, _ = glamour.NewTermRenderer(
				glamour.WithAutoStyle(),
				glamour.WithWordWrap(halfWidth-6), // Match viewport width
			)
		}

		return m, nil

	case TickMsg:
		// Update progress counters for in-progress reviews
		if !m.review1Done {
			m.review1Progress++
		}
		if !m.review2Done {
			m.review2Progress++
		}
		// Update progress counter for aggregation
		if m.mode == ViewModeAggregation && !m.aggregationDone {
			m.aggregationProgress++
		}
		// Keep ticking if reviews or aggregation are still running
		if !m.review1Done || !m.review2Done || (m.mode == ViewModeAggregation && !m.aggregationDone) {
			return m, tickCmd()
		}
		return m, nil

	case ReviewUpdateMsg:
		if msg.ReviewerNum == 1 {
			m.review1Content += msg.Content
			// Render markdown and set viewport content
			rendered := m.renderMarkdown(m.review1Content)
			m.review1Viewport.SetContent(rendered)
			m.review1Viewport.GotoBottom() // Auto-scroll to show new content
			if msg.Done {
				m.review1Done = true
			}
		} else if msg.ReviewerNum == 2 {
			m.review2Content += msg.Content
			// Render markdown and set viewport content
			rendered := m.renderMarkdown(m.review2Content)
			m.review2Viewport.SetContent(rendered)
			m.review2Viewport.GotoBottom() // Auto-scroll to show new content
			if msg.Done {
				m.review2Done = true
			}
		}

		return m, nil

	case ReviewCompleteMsg:
		m.review1Result = msg.Review1
		m.review2Result = msg.Review2
		m.mode = ViewModeDone
		return m, nil // Don't quit - let user press 'q' to exit

	case StartAggregationMsg:
		// Create aggregator selector with available agents
		m.aggregatorSelector = screens.NewAggregatorSelectorModel(m.availableAgents)
		updatedModel, _ := m.aggregatorSelector.Update(tea.WindowSizeMsg{Width: m.width, Height: m.height})
		m.aggregatorSelector = updatedModel.(screens.AggregatorSelectorModel)
		m.mode = ViewModeAggregatorSelector
		return m, m.aggregatorSelector.Init()

	case StartAggregationExecutionMsg:
		// Run the aggregation with the selected agent
		return m, m.runAggregationCmd(msg.AgentName)

	case AggregationUpdateMsg:
		m.aggregationContent += msg.Content
		// Render markdown and set viewport content
		rendered := m.renderMarkdown(m.aggregationContent)
		m.aggregationViewport.SetContent(rendered)
		m.aggregationViewport.GotoBottom() // Auto-scroll to show new content
		if msg.Done {
			m.aggregationDone = true
		}
		return m, nil

	case AggregationCompleteMsg:
		m.aggregationContent = msg.Content
		rendered := m.renderMarkdown(m.aggregationContent)
		m.aggregationViewport.SetContent(rendered)
		m.aggregationDone = true
		return m, nil

	case tea.KeyMsg:
		// Handle aggregator selector in its own mode
		if m.mode == ViewModeAggregatorSelector {
			var cmd tea.Cmd
			var updatedModel tea.Model
			updatedModel, cmd = m.aggregatorSelector.Update(msg)
			m.aggregatorSelector = updatedModel.(screens.AggregatorSelectorModel)

			// Check if selector is done
			if m.aggregatorSelector.Done() {
				if m.aggregatorSelector.Cancelled() {
					// Go back to split view
					m.mode = ViewModeDone
					return m, nil
				}
				// Store selected aggregator and transition to aggregation mode
				m.aggregatorName = m.aggregatorSelector.SelectedAgent()
				m.mode = ViewModeAggregation
				m.aggregationDone = false
				m.aggregationProgress = 0
				m.aggregationContent = ""
				m.aggregationViewport.SetContent("Starting aggregation...")
				// Start the aggregation - this will be handled externally by runner
				return m, func() tea.Msg {
					return StartAggregationExecutionMsg{AgentName: m.aggregatorName}
				}
			}
			return m, cmd
		}

		var cmd tea.Cmd
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit

		case "s":
			// Trigger aggregation if reviews are complete
			if m.mode == ViewModeDone && m.review1Done && m.review2Done {
				return m, func() tea.Msg { return StartAggregationMsg{} }
			}

		case "tab":
			// Switch focus between panels
			m.focusedPanel = (m.focusedPanel + 1) % 2
			return m, nil

		case "up", "k":
			// Scroll up in focused panel or aggregation viewport
			if m.mode == ViewModeAggregation {
				m.aggregationViewport, cmd = m.aggregationViewport.Update(msg)
			} else if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd

		case "down", "j":
			// Scroll down in focused panel or aggregation viewport
			if m.mode == ViewModeAggregation {
				m.aggregationViewport, cmd = m.aggregationViewport.Update(msg)
			} else if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd

		case "g":
			// Jump to top (vim-style)
			if m.mode == ViewModeAggregation {
				m.aggregationViewport.GotoTop()
			} else if m.focusedPanel == 0 {
				m.review1Viewport.GotoTop()
			} else {
				m.review2Viewport.GotoTop()
			}
			return m, nil

		case "G":
			// Jump to bottom (vim-style)
			if m.mode == ViewModeAggregation {
				m.aggregationViewport.GotoBottom()
			} else if m.focusedPanel == 0 {
				m.review1Viewport.GotoBottom()
			} else {
				m.review2Viewport.GotoBottom()
			}
			return m, nil

		case "pgup", "pgdown", "home", "end":
			// Page up/down, home/end in focused panel or aggregation viewport
			if m.mode == ViewModeAggregation {
				m.aggregationViewport, cmd = m.aggregationViewport.Update(msg)
			} else if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd

		case "ctrl+u", "ctrl+d":
			// Half-page scroll in focused panel or aggregation viewport
			if m.mode == ViewModeAggregation {
				m.aggregationViewport, cmd = m.aggregationViewport.Update(msg)
			} else if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd
		}

	case error:
		m.err = msg
		return m, tea.Quit
	}

	return m, nil
}

// View renders the UI
func (m Model) View() string {
	if !m.ready {
		return "Initializing..."
	}

	if m.err != nil {
		return fmt.Sprintf("Error: %v\n", m.err)
	}

	switch m.mode {
	case ViewModeSplit, ViewModeDone:
		return m.renderSplitView()
	case ViewModeAggregatorSelector:
		return m.aggregatorSelector.View()
	case ViewModeAggregation:
		return m.renderAggregationView()
	default:
		return "Unknown view mode"
	}
}

// Common styles
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FAFAFA")).
			Background(lipgloss.Color("#7D56F4")).
			PaddingLeft(1).
			PaddingRight(1)

	reviewerStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#874BFD")).
			Padding(1)

	statusInProgress = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#FFD700")).
				Bold(true).
				Render("⚡ In Progress")

	statusComplete = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00FF00")).
			Bold(true).
			Render("✅ Complete")
)

// renderMarkdown renders markdown content with Glamour
// Returns plain text if rendering fails
func (m Model) renderMarkdown(markdown string) string {
	if markdown == "" {
		return "Waiting for review to start..."
	}

	if m.markdownRenderer == nil {
		return markdown // Fallback to plain text
	}

	rendered, err := m.markdownRenderer.Render(markdown)
	if err != nil {
		// If rendering fails, return plain markdown
		return markdown
	}

	return rendered
}
