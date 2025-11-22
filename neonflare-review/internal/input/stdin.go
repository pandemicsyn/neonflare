package input

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
)

// ReadFromStdin reads code from standard input
func ReadFromStdin() (string, error) {
	return ReadFromReader(os.Stdin)
}

// ReadFromReader reads all content from an io.Reader
func ReadFromReader(reader io.Reader) (string, error) {
	var builder strings.Builder
	scanner := bufio.NewScanner(reader)

	// Increase buffer size for large inputs
	const maxCapacity = 1024 * 1024 // 1MB
	buf := make([]byte, maxCapacity)
	scanner.Buffer(buf, maxCapacity)

	for scanner.Scan() {
		builder.WriteString(scanner.Text())
		builder.WriteString("\n")
	}

	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("error reading from stdin: %w", err)
	}

	content := builder.String()
	if content == "" {
		return "", fmt.Errorf("no input received from stdin")
	}

	return content, nil
}
