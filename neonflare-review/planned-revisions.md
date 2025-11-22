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
