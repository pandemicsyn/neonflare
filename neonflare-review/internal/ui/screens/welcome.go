package screens

import (
	"fmt"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// WelcomeChoice represents the user's choice from the welcome screen
type WelcomeChoice int

const (
	ChoiceQuickStart WelcomeChoice = iota
	ChoiceCustomReview
	ChoiceSettings
	ChoiceQuit
)

type keyMap struct {
	Up     key.Binding
	Down   key.Binding
	Select key.Binding
	Quit   key.Binding
}

var keys = keyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "move up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "move down"),
	),
	Select: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "esc", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
}

// WelcomeModel represents the welcome screen
type WelcomeModel struct {
	choices  []string
	cursor   int
	selected WelcomeChoice
	done     bool
	width    int
	height   int
}

// NewWelcomeModel creates a new welcome screen model
func NewWelcomeModel() WelcomeModel {
	return WelcomeModel{
		choices: []string{
			"Quick Start - Review with default settings",
			"Custom Review - Choose agents and configure",
			"Settings - Edit configuration",
			"Quit",
		},
		cursor:   0,
		selected: ChoiceQuickStart,
		done:     false,
	}
}

// Init initializes the welcome model
func (m WelcomeModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for the welcome screen
func (m WelcomeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Quit):
			m.done = true
			m.selected = ChoiceQuit
			return m, tea.Quit

		case key.Matches(msg, keys.Up):
			if m.cursor > 0 {
				m.cursor--
			}

		case key.Matches(msg, keys.Down):
			if m.cursor < len(m.choices)-1 {
				m.cursor++
			}

		case key.Matches(msg, keys.Select):
			m.done = true
			m.selected = WelcomeChoice(m.cursor)
			if m.selected == ChoiceQuit {
				return m, tea.Quit
			}
			return m, nil
		}
	}

	return m, nil
}

// View renders the welcome screen
func (m WelcomeModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#7D56F4")).
		Padding(1, 0)

	title := titleStyle.Render("🔍 Neonflare Multi-Agent Code Review")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render("Collaborative AI code reviews using multiple agents")

	// Menu items
	menuStyle := lipgloss.NewStyle().
		Padding(1, 2)

	var menuItems []string
	for i, choice := range m.choices {
		cursor := "  "
		if m.cursor == i {
			cursor = "▶ "
		}

		itemStyle := lipgloss.NewStyle()
		if m.cursor == i {
			itemStyle = itemStyle.
				Bold(true).
				Foreground(lipgloss.Color("#7D56F4"))
		}

		menuItems = append(menuItems, fmt.Sprintf("%s%s", cursor, itemStyle.Render(choice)))
	}

	menu := menuStyle.Render(lipgloss.JoinVertical(lipgloss.Left, menuItems...))

	// Help
	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(1, 0)

	help := helpStyle.Render("↑/↓ or j/k: navigate • enter: select • q: quit")

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

// Done returns whether the user has made a selection
func (m WelcomeModel) Done() bool {
	return m.done
}

// Selected returns the user's choice
func (m WelcomeModel) Selected() WelcomeChoice {
	return m.selected
}
