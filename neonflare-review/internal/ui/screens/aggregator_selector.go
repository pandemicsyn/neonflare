package screens

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// AggregatorSelectorModel represents the aggregator agent selection screen
type AggregatorSelectorModel struct {
	availableAgents []string
	selectedIndex   int // Index into availableAgents
	done            bool
	cancelled       bool
	width           int
	height          int
}

// NewAggregatorSelectorModel creates a new aggregator selector
func NewAggregatorSelectorModel(availableAgents []string) AggregatorSelectorModel {
	// Default to first agent (kilocode preferred)
	selectedIndex := 0

	return AggregatorSelectorModel{
		availableAgents: availableAgents,
		selectedIndex:   selectedIndex,
		done:            false,
		cancelled:       false,
	}
}

// Init initializes the aggregator selector
func (m AggregatorSelectorModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for the aggregator selector
func (m AggregatorSelectorModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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

		case "left", "h":
			// Cycle through agents
			if m.selectedIndex > 0 {
				m.selectedIndex--
			} else {
				m.selectedIndex = len(m.availableAgents) - 1
			}

		case "right", "l":
			// Cycle through agents
			if m.selectedIndex < len(m.availableAgents)-1 {
				m.selectedIndex++
			} else {
				m.selectedIndex = 0
			}

		case "enter":
			m.done = true
			return m, nil
		}
	}

	return m, nil
}

// View renders the aggregator selector screen
func (m AggregatorSelectorModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	title := titleStyle.Render("Select Agent for Aggregation")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render("Choose which agent will synthesize and validate the two reviews")

	// Field styles
	labelStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#AAAAAA")).
		Width(15)

	focusedStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Background(lipgloss.Color("#3C3C3C")).
		Padding(0, 1)

	// Aggregator field
	aggregatorLabel := labelStyle.Render("Aggregator:")
	aggregatorValue := m.availableAgents[m.selectedIndex]
	aggregatorValue = focusedStyle.Render(fmt.Sprintf("< %s >", aggregatorValue))
	aggregatorLine := fmt.Sprintf("%s %s", aggregatorLabel, aggregatorValue)

	// Form content
	formStyle := lipgloss.NewStyle().
		Padding(1, 2)

	form := formStyle.Render(aggregatorLine)

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("←/→: change agent • enter: confirm • esc: back")

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
func (m AggregatorSelectorModel) Done() bool {
	return m.done
}

// Cancelled returns whether the user cancelled
func (m AggregatorSelectorModel) Cancelled() bool {
	return m.cancelled
}

// SelectedAgent returns the selected aggregator agent
func (m AggregatorSelectorModel) SelectedAgent() string {
	return m.availableAgents[m.selectedIndex]
}
