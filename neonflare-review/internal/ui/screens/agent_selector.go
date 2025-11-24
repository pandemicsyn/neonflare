package screens

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// AgentSelectorModel represents the agent selection screen
type AgentSelectorModel struct {
	availableAgents []string
	reviewer1Index  int      // Index into availableAgents
	reviewer2Index  int      // Index into availableAgents
	profileNames    []string // List of profile names (including "Default")
	profileIndex    int      // Index into profileNames
	focusedField    int      // 0 = reviewer1, 1 = reviewer2, 2 = profile
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
		profileNames:    []string{}, // Will be set later if profiles available
		profileIndex:    0,           // Default to "Default" which will be at index 0
		focusedField:    0,
		done:            false,
		cancelled:       false,
	}
}

// NewAgentSelectorModelWithProfiles creates a new agent selector with prompt profiles
func NewAgentSelectorModelWithProfiles(availableAgents []string, profileNames []string) AgentSelectorModel {
	// Default to first two agents (or first agent twice if only one available)
	reviewer1 := 0
	reviewer2 := 0
	if len(availableAgents) > 1 {
		reviewer2 = 1
	}

	// Prepend "Default" to profile names
	profiles := append([]string{"Default"}, profileNames...)

	return AgentSelectorModel{
		availableAgents: availableAgents,
		reviewer1Index:  reviewer1,
		reviewer2Index:  reviewer2,
		profileNames:    profiles,
		profileIndex:    0, // Start with "Default" selected
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
			maxField := 1 // reviewer1, reviewer2
			if len(m.profileNames) > 0 {
				maxField = 2 // reviewer1, reviewer2, profile
			}
			if m.focusedField < maxField {
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
			} else if m.focusedField == 1 {
				if m.reviewer2Index > 0 {
					m.reviewer2Index--
				} else {
					m.reviewer2Index = len(m.availableAgents) - 1
				}
			} else if m.focusedField == 2 {
				if m.profileIndex > 0 {
					m.profileIndex--
				} else {
					m.profileIndex = len(m.profileNames) - 1
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
			} else if m.focusedField == 1 {
				if m.reviewer2Index < len(m.availableAgents)-1 {
					m.reviewer2Index++
				} else {
					m.reviewer2Index = 0
				}
			} else if m.focusedField == 2 {
				if m.profileIndex < len(m.profileNames)-1 {
					m.profileIndex++
				} else {
					m.profileIndex = 0
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

	formLines := []string{
		reviewer1Line,
		"",
		reviewer2Line,
	}

	// Add profile field if profiles are available
	if len(m.profileNames) > 0 {
		profileLabel := labelStyle.Render("Prompt Profile:")
		profileValue := m.profileNames[m.profileIndex]
		if m.focusedField == 2 {
			profileValue = focusedStyle.Render(fmt.Sprintf("< %s >", profileValue))
		} else {
			profileValue = normalStyle.Render(profileValue)
		}
		profileLine := fmt.Sprintf("%s %s", profileLabel, profileValue)
		formLines = append(formLines, "", profileLine)
	}

	form := formStyle.Render(lipgloss.JoinVertical(
		lipgloss.Left,
		formLines...,
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

// SelectedProfile returns the selected profile name ("" for Default)
func (m AgentSelectorModel) SelectedProfile() string {
	if len(m.profileNames) == 0 {
		return "" // No profiles available
	}
	selected := m.profileNames[m.profileIndex]
	if selected == "Default" {
		return "" // Empty string indicates default prompt
	}
	return selected
}
