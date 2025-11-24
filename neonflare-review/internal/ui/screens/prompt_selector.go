package screens

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// PromptSelectorModel represents the prompt profile selection screen
type PromptSelectorModel struct {
	profiles      []string // List of profile names (including "Default")
	selectedIndex int      // Index into profiles
	done          bool
	cancelled     bool
	width         int
	height        int
}

// NewPromptSelectorModel creates a new prompt selector
func NewPromptSelectorModel(profileNames []string) PromptSelectorModel {
	// Prepend "Default" option
	options := append([]string{"Default"}, profileNames...)

	return PromptSelectorModel{
		profiles:      options,
		selectedIndex: 0, // Start with "Default" selected
		done:          false,
		cancelled:     false,
	}
}

// Init initializes the prompt selector
func (m PromptSelectorModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for the prompt selector
func (m PromptSelectorModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
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
			if m.selectedIndex > 0 {
				m.selectedIndex--
			}

		case "down", "j":
			if m.selectedIndex < len(m.profiles)-1 {
				m.selectedIndex++
			}

		case "enter":
			m.done = true
			return m, nil
		}
	}

	return m, nil
}

// View renders the prompt selector screen
func (m PromptSelectorModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	title := titleStyle.Render("Select Review Prompt Profile")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render("Choose a specialized prompt or use the default generic review prompt")

	// List styles
	normalStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#FFFFFF")).
		Padding(0, 2)

	selectedStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Background(lipgloss.Color("#3C3C3C")).
		Padding(0, 2)

	// Build list
	var listItems []string
	for i, profile := range m.profiles {
		prefix := "  "
		if i == m.selectedIndex {
			prefix = "❯ "
			listItems = append(listItems, selectedStyle.Render(prefix+profile))
		} else {
			listItems = append(listItems, normalStyle.Render(prefix+profile))
		}
	}

	// Form content
	formStyle := lipgloss.NewStyle().
		Padding(1, 2)

	form := formStyle.Render(lipgloss.JoinVertical(lipgloss.Left, listItems...))

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("↑/↓: navigate • enter: select • esc: back")

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
func (m PromptSelectorModel) Done() bool {
	return m.done
}

// Cancelled returns whether the user cancelled
func (m PromptSelectorModel) Cancelled() bool {
	return m.cancelled
}

// SelectedProfile returns the selected profile name ("" for Default, or profile name)
func (m PromptSelectorModel) SelectedProfile() string {
	selected := m.profiles[m.selectedIndex]
	if selected == "Default" {
		return "" // Empty string indicates default prompt
	}
	return selected
}
