package ui

import (
	"fmt"
	"strings"
	"time"

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
	review1Content   strings.Builder
	review2Content   strings.Builder
	review1Done      bool
	review2Done      bool
	review1Progress  int // Seconds elapsed
	review2Progress  int // Seconds elapsed

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
	return Model{
		mode:          ViewModeSplit,
		reviewer1Name: reviewer1,
		reviewer2Name: reviewer2,
		metadata:      metadata,
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
			m.review1Content.WriteString(msg.Content)
			if msg.Done {
				m.review1Done = true
			}
		} else if msg.ReviewerNum == 2 {
			m.review2Content.WriteString(msg.Content)
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
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
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
