package agents

import "regexp"

// ansiRegex matches ANSI escape sequences including:
// - CSI sequences: \x1b[...m (colors, styles, cursor control)
// - OSC sequences: \x1b]...ST (operating system commands)
// - Other escape sequences: \x1b(...
var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\a]*(?:\a|\x1b\\)|\x1b[>=]|\x1b\([0-9;]*[a-zA-Z]`)

// StripANSI removes ANSI escape sequences from text
// This is useful for cleaning output from CLI tools that emit color codes
// and terminal control sequences when running in non-interactive mode
func StripANSI(text string) string {
	return ansiRegex.ReplaceAllString(text, "")
}
