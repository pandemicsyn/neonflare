package ui

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
)

// ViewMode represents the current UI state
type ViewMode int

const (
	ViewModeSplit ViewMode = iota // Split view for parallel reviews
	ViewModeDone                   // Review complete
)

// Model represents the Bubbletea model for the review UI
type Model struct {
	// State
	mode          ViewMode
	width         int
	height        int
	ready         bool
	err           error

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

	// Results
	review1Result *agents.Review
	review2Result *agents.Review

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

// TickMsg is sent periodically to update progress
type TickMsg time.Time

// NewModel creates a new UI model
func NewModel(reviewer1, reviewer2, _ string, metadata map[string]string) Model {
	// Create viewports for scrolling (dimensions will be set on WindowSizeMsg)
	vp1 := viewport.New(80, 20)
	vp1.SetContent("Waiting for review to start...")

	vp2 := viewport.New(80, 20)
	vp2.SetContent("Waiting for review to start...")

	return Model{
		mode:            ViewModeSplit,
		reviewer1Name:   reviewer1,
		reviewer2Name:   reviewer2,
		metadata:        metadata,
		review1Viewport: vp1,
		review2Viewport: vp2,
		focusedPanel:    0, // Start with left panel focused
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

		return m, nil

	case TickMsg:
		// Update progress counters for in-progress reviews
		if !m.review1Done {
			m.review1Progress++
		}
		if !m.review2Done {
			m.review2Progress++
		}
		// Keep ticking if reviews are still running
		if !m.review1Done || !m.review2Done {
			return m, tickCmd()
		}
		return m, nil

	case ReviewUpdateMsg:
		if msg.ReviewerNum == 1 {
			m.review1Content += msg.Content
			m.review1Viewport.SetContent(m.review1Content)
			m.review1Viewport.GotoBottom() // Auto-scroll to show new content
			if msg.Done {
				m.review1Done = true
			}
		} else if msg.ReviewerNum == 2 {
			m.review2Content += msg.Content
			m.review2Viewport.SetContent(m.review2Content)
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

	case tea.KeyMsg:
		var cmd tea.Cmd
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit

		case "tab":
			// Switch focus between panels
			m.focusedPanel = (m.focusedPanel + 1) % 2
			return m, nil

		case "up", "k":
			// Scroll up in focused panel
			if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd

		case "down", "j":
			// Scroll down in focused panel
			if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd

		case "g":
			// Jump to top (vim-style)
			if m.focusedPanel == 0 {
				m.review1Viewport.GotoTop()
			} else {
				m.review2Viewport.GotoTop()
			}
			return m, nil

		case "G":
			// Jump to bottom (vim-style)
			if m.focusedPanel == 0 {
				m.review1Viewport.GotoBottom()
			} else {
				m.review2Viewport.GotoBottom()
			}
			return m, nil

		case "pgup", "pgdown", "home", "end":
			// Page up/down, home/end in focused panel
			if m.focusedPanel == 0 {
				m.review1Viewport, cmd = m.review1Viewport.Update(msg)
			} else {
				m.review2Viewport, cmd = m.review2Viewport.Update(msg)
			}
			return m, cmd

		case "ctrl+u", "ctrl+d":
			// Half-page scroll in focused panel
			if m.focusedPanel == 0 {
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
