package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// renderSplitView renders the split-screen view for parallel reviews
func (m Model) renderSplitView() string {
	if m.width == 0 || m.height == 0 {
		return "Waiting for terminal size..."
	}

	// Calculate dimensions for split view
	halfWidth := (m.width - 4) / 2 // -4 for borders and padding
	contentHeight := m.height - 8  // Leave room for title and status

	// Create styles for left and right panels
	panelStyle := lipgloss.NewStyle().
		Width(halfWidth).
		Height(contentHeight).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#874BFD")).
		Padding(1)

	// Build header
	header := titleStyle.Render(fmt.Sprintf(" 🔍 Neonflare Review - Parallel Reviews "))
	header += "\n\n"

	// Left panel - Reviewer 1
	leftTitle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FF79C6")).
		Render(fmt.Sprintf("Reviewer 1: %s", m.reviewer1Name))

	leftStatus := statusInProgress
	progressText := ""
	if m.review1Done {
		leftStatus = statusComplete
	} else if m.review1Progress > 0 {
		progressText = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" (%ds)", m.review1Progress))
	}

	leftContent := m.review1Content
	if leftContent == "" {
		leftContent = "Waiting for review to start..."
	}

	// Truncate content to fit panel
	leftLines := strings.Split(leftContent, "\n")
	if len(leftLines) > contentHeight-3 {
		leftLines = leftLines[len(leftLines)-(contentHeight-3):]
		leftContent = strings.Join(leftLines, "\n")
	}

	leftPanel := fmt.Sprintf("%s\n%s%s\n\n%s", leftTitle, leftStatus, progressText, leftContent)

	// Right panel - Reviewer 2
	rightTitle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#50FA7B")).
		Render(fmt.Sprintf("Reviewer 2: %s", m.reviewer2Name))

	rightStatus := statusInProgress
	progressText2 := ""
	if m.review2Done {
		rightStatus = statusComplete
	} else if m.review2Progress > 0 {
		progressText2 = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" (%ds)", m.review2Progress))
	}

	rightContent := m.review2Content
	if rightContent == "" {
		rightContent = "Waiting for review to start..."
	}

	// Truncate content to fit panel
	rightLines := strings.Split(rightContent, "\n")
	if len(rightLines) > contentHeight-3 {
		rightLines = rightLines[len(rightLines)-(contentHeight-3):]
		rightContent = strings.Join(rightLines, "\n")
	}

	rightPanel := fmt.Sprintf("%s\n%s%s\n\n%s", rightTitle, rightStatus, progressText2, rightContent)

	// Combine panels side by side
	panels := lipgloss.JoinHorizontal(
		lipgloss.Top,
		panelStyle.Render(leftPanel),
		panelStyle.Render(rightPanel),
	)

	// Footer - change message when both reviews are done
	footerText := "Press Ctrl+C or 'q' to quit"
	if m.review1Done && m.review2Done {
		footerText = "✓ Reviews complete! Press 'q' to exit and save results"
	}
	footer := "\n" + lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Render(footerText)

	return header + panels + footer
}
