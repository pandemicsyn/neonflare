package screens

import (
	"fmt"
	"strconv"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
)

// ConfigField represents a field in the configuration
type ConfigField struct {
	Name        string
	Description string
	Value       string
}

// ConfigEditorModel represents the configuration editor screen
type ConfigEditorModel struct {
	config       *config.Config
	fields       []ConfigField
	inputs       []textinput.Model
	focusedIndex int
	done         bool
	cancelled    bool
	width        int
	height       int
}

// NewConfigEditorModel creates a new configuration editor
func NewConfigEditorModel(cfg *config.Config) ConfigEditorModel {
	fields := []ConfigField{
		{
			Name:        "Codex Model",
			Description: "Model for Codex agent",
			Value:       cfg.Agents.Codex.Model,
		},
		{
			Name:        "Claude Model",
			Description: "Model for Claude agent",
			Value:       cfg.Agents.Claude.Model,
		},
		{
			Name:        "Kilocode Model",
			Description: "Model for Kilocode agent",
			Value:       cfg.Agents.Kilocode.Model,
		},
		{
			Name:        "Timeout (seconds)",
			Description: "Timeout for agent execution",
			Value:       fmt.Sprintf("%d", int(cfg.Agents.Codex.Timeout.Seconds())),
		},
	}

	inputs := make([]textinput.Model, len(fields))
	for i, field := range fields {
		ti := textinput.New()
		ti.Placeholder = field.Description
		ti.SetValue(field.Value)
		ti.CharLimit = 100
		if i == 0 {
			ti.Focus()
		}
		inputs[i] = ti
	}

	return ConfigEditorModel{
		config:       cfg,
		fields:       fields,
		inputs:       inputs,
		focusedIndex: 0,
		done:         false,
		cancelled:    false,
	}
}

// Init initializes the config editor
func (m ConfigEditorModel) Init() tea.Cmd {
	return textinput.Blink
}

// Update handles messages for the config editor
func (m ConfigEditorModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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

		case "tab", "down", "j":
			// Move to next field
			m.inputs[m.focusedIndex].Blur()
			m.focusedIndex = (m.focusedIndex + 1) % len(m.inputs)
			return m, m.inputs[m.focusedIndex].Focus()

		case "shift+tab", "up", "k":
			// Move to previous field
			m.inputs[m.focusedIndex].Blur()
			m.focusedIndex--
			if m.focusedIndex < 0 {
				m.focusedIndex = len(m.inputs) - 1
			}
			return m, m.inputs[m.focusedIndex].Focus()

		case "enter":
			// Save configuration
			m.applyChanges()
			m.done = true
			return m, nil
		}
	}

	// Update the focused input
	var cmd tea.Cmd
	m.inputs[m.focusedIndex], cmd = m.inputs[m.focusedIndex].Update(msg)
	return m, cmd
}

// applyChanges applies the edited values to the configuration
func (m *ConfigEditorModel) applyChanges() {
	// Update model values
	if len(m.inputs) > 0 {
		m.config.Agents.Codex.Model = m.inputs[0].Value()
	}
	if len(m.inputs) > 1 {
		m.config.Agents.Claude.Model = m.inputs[1].Value()
	}
	if len(m.inputs) > 2 {
		m.config.Agents.Kilocode.Model = m.inputs[2].Value()
	}
	if len(m.inputs) > 3 {
		if timeout, err := strconv.Atoi(m.inputs[3].Value()); err == nil {
			timeoutDuration := time.Duration(timeout) * time.Second
			m.config.Agents.Codex.Timeout = timeoutDuration
			m.config.Agents.Claude.Timeout = timeoutDuration
			m.config.Agents.Kilocode.Timeout = timeoutDuration
		}
	}
}

// View renders the config editor screen
func (m ConfigEditorModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	title := titleStyle.Render("Configuration Editor")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render("Edit agent models and settings")

	// Form fields
	formStyle := lipgloss.NewStyle().
		Padding(1, 2)

	var formItems []string
	for i, field := range m.fields {
		labelStyle := lipgloss.NewStyle().
			Foreground(lipgloss.Color("#999999"))

		label := labelStyle.Render(field.Name + ":")

		inputStyle := lipgloss.NewStyle().
			Width(50)

		input := inputStyle.Render(m.inputs[i].View())

		formItems = append(formItems, fmt.Sprintf("%s\n%s", label, input))
	}

	form := formStyle.Render(lipgloss.JoinVertical(lipgloss.Left, formItems...))

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("tab/↑/↓: navigate fields • enter: save • esc: cancel")

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

// Done returns whether the user has completed editing
func (m ConfigEditorModel) Done() bool {
	return m.done
}

// Cancelled returns whether the user cancelled
func (m ConfigEditorModel) Cancelled() bool {
	return m.cancelled
}

// Config returns the updated configuration
func (m ConfigEditorModel) Config() *config.Config {
	return m.config
}
