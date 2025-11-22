package screens

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
)

// ConfirmationModel represents the confirmation screen
type ConfirmationModel struct {
	config        *config.Config
	selectedAgents []string
	inputSource   string
	userPrompt    string
	confirmed     bool
	cancelled     bool
	done          bool
	width         int
	height        int
}

// NewConfirmationModel creates a new confirmation screen
func NewConfirmationModel(cfg *config.Config, selectedAgents []string, inputSource string, userPrompt string) ConfirmationModel {
	return ConfirmationModel{
		config:        cfg,
		selectedAgents: selectedAgents,
		inputSource:   inputSource,
		userPrompt:    userPrompt,
		confirmed:     false,
		cancelled:     false,
		done:          false,
	}
}

// Init initializes the confirmation screen
func (m ConfirmationModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for the confirmation screen
func (m ConfirmationModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc", "n":
			m.done = true
			m.cancelled = true
			return m, nil

		case "enter", "y":
			m.done = true
			m.confirmed = true
			return m, nil
		}
	}

	return m, nil
}

// View renders the confirmation screen
func (m ConfirmationModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	title := titleStyle.Render("Review Configuration")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render("Please confirm the following settings:")

	// Settings box
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#7D56F4")).
		Padding(1, 2).
		Width(60)

	labelStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4"))

	valueStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFFFFF"))

	var settings []string

	// Selected agents
	settings = append(settings,
		labelStyle.Render("Selected Agents:"),
		valueStyle.Render("  "+strings.Join(m.selectedAgents, ", ")),
		"",
	)

	// Agent models
	settings = append(settings, labelStyle.Render("Agent Models:"))
	for _, agentName := range m.selectedAgents {
		if agentCfg, err := m.config.GetAgentConfig(agentName); err == nil {
			settings = append(settings,
				valueStyle.Render(fmt.Sprintf("  %s: %s", agentName, agentCfg.Model)),
			)
		}
	}
	settings = append(settings, "")

	// Input source
	settings = append(settings,
		labelStyle.Render("Input Source:"),
		valueStyle.Render("  "+m.inputSource),
		"",
	)

	// User prompt (truncated if long)
	promptPreview := m.userPrompt
	if len(promptPreview) > 100 {
		promptPreview = promptPreview[:97] + "..."
	}
	if promptPreview != "" {
		settings = append(settings,
			labelStyle.Render("Custom Prompt:"),
			valueStyle.Render("  "+promptPreview),
			"",
		)
	}

	// Timeout (use codex timeout as representative)
	settings = append(settings,
		labelStyle.Render("Timeout:"),
		valueStyle.Render(fmt.Sprintf("  %v", m.config.Agents.Codex.Timeout)),
	)

	settingsBox := boxStyle.Render(lipgloss.JoinVertical(lipgloss.Left, settings...))

	// Confirmation prompt
	confirmStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	confirm := confirmStyle.Render("Start the review? (y/n)")

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("y/enter: start review • n/esc: go back")

	// Combine all sections
	content := lipgloss.JoinVertical(
		lipgloss.Left,
		title,
		desc,
		settingsBox,
		confirm,
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

// Done returns whether the user has made a decision
func (m ConfirmationModel) Done() bool {
	return m.done
}

// Confirmed returns whether the user confirmed
func (m ConfirmationModel) Confirmed() bool {
	return m.confirmed
}

// Cancelled returns whether the user cancelled
func (m ConfirmationModel) Cancelled() bool {
	return m.cancelled
}
