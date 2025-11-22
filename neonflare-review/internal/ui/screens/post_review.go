package screens

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// PostReviewAction represents the user's choice from the post-review menu
type PostReviewAction int

const (
	ActionViewReviews PostReviewAction = iota
	ActionOpenFiles
	ActionNewReview
	ActionExit
)

// PostReviewModel represents the post-review menu screen
type PostReviewModel struct {
	outputFiles []string
	choices     []string
	cursor      int
	selected    PostReviewAction
	done        bool
	width       int
	height      int
}

// NewPostReviewModel creates a new post-review menu
func NewPostReviewModel(outputFiles []string) PostReviewModel {
	return PostReviewModel{
		outputFiles: outputFiles,
		choices: []string{
			"View reviews in terminal",
			"Open review files",
			"Start new review",
			"Exit",
		},
		cursor:   0,
		selected: ActionViewReviews,
		done:     false,
	}
}

// Init initializes the post-review menu
func (m PostReviewModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for the post-review menu
func (m PostReviewModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			m.done = true
			m.selected = ActionExit
			return m, tea.Quit

		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			if m.cursor < len(m.choices)-1 {
				m.cursor++
			}

		case "enter":
			m.done = true
			m.selected = PostReviewAction(m.cursor)
			if m.selected == ActionExit {
				return m, tea.Quit
			}
			return m, nil
		}
	}

	return m, nil
}

// View renders the post-review menu screen
func (m PostReviewModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Title
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#00FF00")).
		Padding(1, 0)

	title := titleStyle.Render("✓ Review Complete!")

	// Description
	descStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#999999")).
		Padding(0, 0, 1, 0)

	desc := descStyle.Render(fmt.Sprintf("Review files saved to: %s", m.outputFiles[0]))

	// Output files list
	filesStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Padding(0, 2, 1, 2)

	var filesList []string
	for _, file := range m.outputFiles {
		filesList = append(filesList, "• "+file)
	}
	files := filesStyle.Render(lipgloss.JoinVertical(lipgloss.Left, filesList...))

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
		files,
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
func (m PostReviewModel) Done() bool {
	return m.done
}

// Selected returns the user's choice
func (m PostReviewModel) Selected() PostReviewAction {
	return m.selected
}

// OutputFiles returns the list of output files
func (m PostReviewModel) OutputFiles() []string {
	return m.outputFiles
}
