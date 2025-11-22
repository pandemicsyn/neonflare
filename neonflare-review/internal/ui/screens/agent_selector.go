package screens

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// AgentSelectorModel represents the agent selection screen
type AgentSelectorModel struct {
	availableAgents []string
	reviewer1Index  int // Index into availableAgents
	reviewer2Index  int // Index into availableAgents
	focusedField    int // 0 = reviewer1, 1 = reviewer2
	done            bool
	cancelled       bool
	width           int
	height          int
}

// NewAgentSelectorModel creates a new agent selector
func NewAgentSelectorModel(availableAgents []string) AgentSelectorModel {
	// Default to first two agents (or first agent twice if only one available)
	reviewer1 := 0
	reviewer2 := 0
	if len(availableAgents) > 1 {
		reviewer2 = 1
	}

	return AgentSelectorModel{
		availableAgents: availableAgents,
		reviewer1Index:  reviewer1,
		reviewer2Index:  reviewer2,
		focusedField:    0,
		done:            false,
		cancelled:       false,
	}
}

// Init initializes the agent selector
func (m AgentSelectorModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for the agent selector
func (m AgentSelectorModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			m.done = true
			m.cancelled = true
			return m, nil

		case "up", "k":
			// Move focus between fields
			if m.focusedField > 0 {
				m.focusedField--
			}

		case "down", "j":
			// Move focus between fields
			if m.focusedField < 1 {
				m.focusedField++
			}

		case "left", "h":
			// Change selection for focused field
			if m.focusedField == 0 {
				if m.reviewer1Index > 0 {
					m.reviewer1Index--
				} else {
					m.reviewer1Index = len(m.availableAgents) - 1
				}
			} else {
				if m.reviewer2Index > 0 {
					m.reviewer2Index--
				} else {
					m.reviewer2Index = len(m.availableAgents) - 1
				}
			}

		case "right", "l":
			// Change selection for focused field
			if m.focusedField == 0 {
				if m.reviewer1Index < len(m.availableAgents)-1 {
					m.reviewer1Index++
				} else {
					m.reviewer1Index = 0
				}
			} else {
				if m.reviewer2Index < len(m.availableAgents)-1 {
					m.reviewer2Index++
				} else {
					m.reviewer2Index = 0
				}
			}

		case "enter":
			m.done = true
			return m, nil
		}
	}

	return m, nil
}

// View renders the agent selector screen
func (m AgentSelectorModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	title := titleStyle.Render("Select Reviewers")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render("Choose which agents to use as reviewers (can pick the same agent twice)")

	// Field styles
	labelStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#AAAAAA")).
		Width(15)

	focusedStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Background(lipgloss.Color("#3C3C3C")).
		Padding(0, 1)

	normalStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFFFFF")).
		Padding(0, 1)

	// Reviewer 1 field
	reviewer1Label := labelStyle.Render("Reviewer 1:")
	reviewer1Value := m.availableAgents[m.reviewer1Index]
	if m.focusedField == 0 {
		reviewer1Value = focusedStyle.Render(fmt.Sprintf("< %s >", reviewer1Value))
	} else {
		reviewer1Value = normalStyle.Render(reviewer1Value)
	}
	reviewer1Line := fmt.Sprintf("%s %s", reviewer1Label, reviewer1Value)

	// Reviewer 2 field
	reviewer2Label := labelStyle.Render("Reviewer 2:")
	reviewer2Value := m.availableAgents[m.reviewer2Index]
	if m.focusedField == 1 {
		reviewer2Value = focusedStyle.Render(fmt.Sprintf("< %s >", reviewer2Value))
	} else {
		reviewer2Value = normalStyle.Render(reviewer2Value)
	}
	reviewer2Line := fmt.Sprintf("%s %s", reviewer2Label, reviewer2Value)

	// Form content
	formStyle := lipgloss.NewStyle().
		Padding(1, 2)

	form := formStyle.Render(lipgloss.JoinVertical(
		lipgloss.Left,
		reviewer1Line,
		"",
		reviewer2Line,
	))

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("↑/↓: switch field • ←/→: change agent • enter: confirm • esc: back")

	// Combine all sections
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		desc,
		form,
		help,
	)

	// Center the content
	containerStyle := lipgloss.NewStyle().
		Width(m.width).
		Height(m.height).
		AlignVertical(lipgloss.Center).
		AlignHorizontal(lipgloss.Center)

	return containerStyle.Render(content)
}

// Done returns whether the user has confirmed their selection
func (m AgentSelectorModel) Done() bool {
	return m.done
}

// Cancelled returns whether the user cancelled
func (m AgentSelectorModel) Cancelled() bool {
	return m.cancelled
}

// SelectedAgents returns [reviewer1, reviewer2] (may be duplicates)
func (m AgentSelectorModel) SelectedAgents() []string {
	return []string{
		m.availableAgents[m.reviewer1Index],
		m.availableAgents[m.reviewer2Index],
	}
}
