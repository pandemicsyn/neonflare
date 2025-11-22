package screens

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// AgentSelectorModel represents the agent selection screen
type AgentSelectorModel struct {
	availableAgents []string
	selected        map[string]bool
	cursor          int
	done            bool
	cancelled       bool
	width           int
	height          int
}

// NewAgentSelectorModel creates a new agent selector
func NewAgentSelectorModel(availableAgents []string) AgentSelectorModel {
	selected := make(map[string]bool)
	// Default: all agents selected
	for _, agent := range availableAgents {
		selected[agent] = true
	}

	return AgentSelectorModel{
		availableAgents: availableAgents,
		selected:        selected,
		cursor:          0,
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
			if m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			if m.cursor < len(m.availableAgents)-1 {
				m.cursor++
			}

		case " ":
			// Toggle selection
			agent := m.availableAgents[m.cursor]
			m.selected[agent] = !m.selected[agent]

		case "enter":
			// Confirm selection (need at least one agent)
			selectedCount := 0
			for _, sel := range m.selected {
				if sel {
					selectedCount++
				}
			}
			if selectedCount > 0 {
				m.done = true
			}
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

	title := titleStyle.Render("Select Agents")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	selectedCount := 0
	for _, sel := range m.selected {
		if sel {
			selectedCount++
		}
	}

	desc := descStyle.Render(fmt.Sprintf("Choose which agents to use for the review (selected: %d)", selectedCount))

	// Agent list
	menuStyle := lipgloss.NewStyle().
		Padding(1, 2)

	var menuItems []string
	for i, agent := range m.availableAgents {
		cursor := "  "
		if m.cursor == i {
			cursor = "▶ "
		}

		checkbox := "☐"
		if m.selected[agent] {
			checkbox = "☑"
		}

		itemStyle := lipgloss.NewStyle()
		if m.cursor == i {
			itemStyle = itemStyle.
				Bold(true).
				Foreground(lipgloss.Color("#7D56F4"))
		}

		menuItems = append(menuItems, fmt.Sprintf("%s%s %s", cursor, checkbox, itemStyle.Render(agent)))
	}

	menu := menuStyle.Render(lipgloss.JoinVertical(lipgloss.Left, menuItems...))

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("↑/↓ or j/k: navigate • space: toggle • enter: confirm • esc: back")

	// Combine all sections
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		desc,
		menu,
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

// SelectedAgents returns the list of selected agent names
func (m AgentSelectorModel) SelectedAgents() []string {
	var result []string
	for _, agent := range m.availableAgents {
		if m.selected[agent] {
			result = append(result, agent)
		}
	}
	return result
}
