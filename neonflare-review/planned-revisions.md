# Planned Revisions for Streaming Output

## Issue 1: Chunk-Based Reading Instead of Line-Based

### Current Problem
- Reading line-by-line with `reader.ReadString('\n')` waits for complete lines
- CLI tools may buffer output or not send frequent newlines
- Results in no visible streaming until large chunks complete

### Proposed Solution
Implement chunk-based reading with periodic updates:

1. **Replace line-based reading with chunk-based reading**
   - File: `internal/agents/executor.go`
   - Change from `reader.ReadString('\n')` to `Read(buf)` with fixed-size buffer
   - Read in 4KB chunks or smaller for more granular updates

2. **Add periodic flushing mechanism**
   - Use a ticker to send accumulated data every N milliseconds (e.g., 100ms)
   - Ensures UI updates even if data doesn't fill buffer
   - Prevents blocking on partial chunks

3. **Implementation approach**
   ```go
   // Pseudocode
   ticker := time.NewTicker(100 * time.Millisecond)
   buf := make([]byte, 4096)
   accumulated := ""

   for {
       select {
       case <-ticker.C:
           // Send accumulated data if any
           if len(accumulated) > 0 && outputCallback != nil {
               outputCallback(accumulated)
               accumulated = ""
           }
       default:
           // Try to read with short timeout
           n, err := read with timeout
           if n > 0 {
               accumulated += string(buf[:n])
           }
       }
   }
   ```

4. **Benefits**
   - More responsive streaming (updates every 100ms instead of per-line)
   - Works regardless of newline frequency
   - Still efficient (4KB buffer size)

## Issue 2: Strip ANSI Control Characters from Kilocode

### Current Problem
- Kilocode sends ANSI terminal control characters in one-shot mode
- These render as garbage in the UI (escape sequences, color codes, etc.)
- Example: `\x1b[0m`, `\x1b[31m`, `\x1b[2J`, etc.

### Proposed Solution
Add ANSI stripping for Kilocode output specifically:

1. **Add ANSI stripping utility**
   - File: `internal/agents/ansi.go` (new file)
   - Implement regex-based ANSI escape sequence stripper
   - Pattern: `\x1b\[[0-9;]*[a-zA-Z]` and similar variants

   ```go
   package agents

   import "regexp"

   var ansiRegex = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]|\x1b\([0-9;]*[a-zA-Z]`)

   // StripANSI removes ANSI escape sequences from text
   func StripANSI(text string) string {
       return ansiRegex.ReplaceAllString(text, "")
   }
   ```

2. **Apply stripping in Kilocode agent**
   - File: `internal/agents/kilocode.go`
   - Wrap outputCallback to strip ANSI before sending to UI
   - Strip from final output as well

   ```go
   // In ExecuteWithCallback
   var wrappedCallback OutputCallback
   if outputCallback != nil {
       wrappedCallback = func(chunk string) {
           cleaned := StripANSI(chunk)
           outputCallback(cleaned)
       }
   }

   output, err := a.ExecuteCommand(ctx, args, "", wrappedCallback)
   if err == nil {
       output = StripANSI(output) // Clean final output too
   }
   ```

3. **Alternative: Check if Kilocode has a flag to disable ANSI**
   - Review Kilocode CLI flags for `--no-color`, `--plain`, or similar
   - If available, add to args array in `kilocode.go`
   - This would be cleaner than stripping

4. **Testing**
   - Test with Kilocode to verify ANSI codes are removed
   - Ensure no valid content is accidentally stripped
   - Verify Claude and Codex agents unaffected (no stripping for them)

## Implementation Order

1. **Phase 1: ANSI Stripping** (Quick win)
   - Add `ansi.go` with StripANSI function
   - Update `kilocode.go` to use stripping
   - Test with Kilocode review
   - ~15-30 minutes

2. **Phase 2: Chunk-Based Reading** (Larger change)
   - Modify `executor.go` to use chunk-based reading
   - Add ticker-based periodic flushing
   - Test with all agents (Claude, Kilocode, Codex)
   - Verify streaming works in real-time
   - ~1-2 hours

## Risks and Considerations

### ANSI Stripping
- **Risk**: May strip valid content if regex is too broad
- **Mitigation**: Use well-tested ANSI regex pattern, add unit tests
- **Risk**: Performance impact of regex on every chunk
- **Mitigation**: Minimal - only applies to Kilocode

### Chunk-Based Reading
- **Risk**: More complex code (ticker + reading + buffering)
- **Mitigation**: Clear separation of concerns, good comments
- **Risk**: May send incomplete UTF-8 sequences
- **Mitigation**: Use `bufio.Reader` which handles UTF-8 boundaries
- **Risk**: Increased callback frequency (more UI updates)
- **Mitigation**: 100ms ticker is reasonable balance (10 updates/sec max)

## Success Criteria

### ANSI Stripping
- ✅ Kilocode output has no visible ANSI escape sequences in UI
- ✅ All actual review content is preserved
- ✅ Claude and Codex output unchanged

### Chunk-Based Reading
- ✅ Output appears in UI within 100-200ms of being produced
- ✅ Progress visible during long-running reviews
- ✅ No "file already closed" errors
- ✅ Complete output captured correctly
- ✅ Works for all three agents (Claude, Kilocode, Codex)

## Issue 3: Add Scrolling Support for Large Output

### Current Problem
- Review output can be very large (thousands of lines)
- Currently truncating to fit panel height (showing only last N lines)
- No way to scroll through complete output during review
- Users can't see earlier parts of long reviews

### Proposed Solution
Add scrollable viewports using Bubbletea's viewport component:

1. **Use Bubbletea Viewport Component**
   - Files: `internal/ui/model.go`, `internal/ui/split_view.go`
   - Add viewport from `github.com/charmbracelet/bubbles/viewport`
   - Create two viewports (one for each reviewer panel)
   - Viewports handle scrolling and content management automatically

2. **Implementation Approach**
   ```go
   import "github.com/charmbracelet/bubbles/viewport"

   type Model struct {
       // ... existing fields ...
       review1Viewport viewport.Model
       review2Viewport viewport.Model
       focusedPanel    int // 0 = left, 1 = right
   }

   // In Update():
   case tea.KeyMsg:
       switch msg.String() {
       case "tab":
           // Switch focus between panels
           m.focusedPanel = (m.focusedPanel + 1) % 2
       case "up", "k":
           // Scroll up in focused panel
           if m.focusedPanel == 0 {
               m.review1Viewport, cmd = m.review1Viewport.Update(msg)
           } else {
               m.review2Viewport, cmd = m.review2Viewport.Update(msg)
           }
       case "down", "j":
           // Scroll down in focused panel
       case "pageup", "pagedown", "home", "end":
           // Handle other scroll keys
       }

   case ReviewUpdateMsg:
       // Append content to viewport
       if msg.ReviewerNum == 1 {
           m.review1Content += msg.Content
           m.review1Viewport.SetContent(m.review1Content)
           m.review1Viewport.GotoBottom() // Auto-scroll to bottom
       }
   ```

3. **Key Bindings**
   - `Tab` - Switch focus between left/right panels
   - `↑/k` - Scroll up one line
   - `↓/j` - Scroll down one line
   - `PgUp/PgDn` - Scroll up/down one page
   - `Home/End` - Jump to top/bottom
   - `Ctrl+U/D` - Scroll half-page up/down

4. **Visual Feedback**
   - Highlight focused panel with different border color
   - Show scroll position indicator (e.g., "25%", "↓ More")
   - Dim unfocused panel slightly

5. **Auto-Scroll Behavior**
   - Auto-scroll to bottom when new content arrives
   - Stop auto-scrolling if user manually scrolls up
   - Resume auto-scrolling when user returns to bottom

### Benefits
- View complete output regardless of length
- Navigate through review while it's still running
- Compare specific sections between reviewers
- Better user experience for large reviews

### Implementation Details

**File: `internal/ui/model.go`**
- Add viewport fields to Model struct
- Initialize viewports in NewModel()
- Handle viewport updates in Update()
- Manage focus state

**File: `internal/ui/split_view.go`**
- Replace manual truncation with viewport rendering
- Add focus indicators (highlighted borders)
- Display scroll position indicators

### Testing
- Test with reviews of varying sizes (10 lines, 100 lines, 10,000 lines)
- Verify scrolling works smoothly
- Test focus switching between panels
- Verify auto-scroll behavior
- Test all key bindings

### Alternatives Considered
1. **Custom scrolling logic** - More work, reinventing the wheel
2. **External pager (less/more)** - Loses real-time updates
3. **Save and view externally** - Defeats purpose of live UI

### Success Criteria
- ✅ Can scroll through complete output (not truncated)
- ✅ Tab switches focus between panels
- ✅ Arrow keys scroll focused panel
- ✅ New content auto-scrolls to bottom
- ✅ Visual feedback shows which panel is focused
- ✅ Scroll position indicator shows location in output
- ✅ Performance remains good with 10,000+ lines
