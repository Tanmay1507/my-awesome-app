const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class TranscriptService extends EventEmitter {
  constructor() {
    super();
    this.baseBrainDir = path.join(
      process.env.USERPROFILE || 'C:\\Users\\tanmay Wagh',
      '.gemini',
      'antigravity-ide',
      'brain'
    );
    this.activeConversationId = null;
    this.activeConversationDir = null;
    this.transcriptPath = null;
    this.lastProcessedOffset = 0;
    this.fileWatcher = null;
    this.planWatcher = null;
    this.pollInterval = null;
    this.cachedItems = [];
    this.cachedPlan = '';
    this.cachedWalkthrough = '';
    // When true the poll will NOT auto-jump to a newer conversation.
    // Set to true after the first successful conversation load so that
    // sending a prompt (which creates a new convo dir momentarily) cannot
    // hijack the active session. Users can still switch via switchConversation().
    this._conversationPinned = false;
  }

  // Initialize service & locate active conversation
  init() {
    this.findActiveConversation();
    this.loadInitialTranscript();
    this.loadArtifacts();
    // Pin the conversation so polling doesn't auto-jump away
    if (this.activeConversationId) {
      this._conversationPinned = true;
    }
    this.startWatching();
  }

  // Find the most recently modified conversation folder with a transcript
  findActiveConversation() {
    try {
      if (!fs.existsSync(this.baseBrainDir)) {
        console.warn(`[Transcript] Brain dir not found: ${this.baseBrainDir}`);
        return null;
      }

      const entries = fs.readdirSync(this.baseBrainDir, { withFileTypes: true });
      const convDirs = entries
        .filter((d) => d.isDirectory() && d.name !== 'tempmediaStorage' && d.name !== 'scratch')
        .map((d) => {
          const fullPath = path.join(this.baseBrainDir, d.name);
          const tPath = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
          let mtime = 0;
          let hasTranscript = false;
          if (fs.existsSync(tPath)) {
            hasTranscript = true;
            mtime = fs.statSync(tPath).mtimeMs;
          } else {
            mtime = fs.statSync(fullPath).mtimeMs;
          }
          return { id: d.name, fullPath, tPath, mtime, hasTranscript };
        })
        .filter((d) => d.hasTranscript)
        .sort((a, b) => b.mtime - a.mtime);

      if (convDirs.length > 0) {
        const active = convDirs[0];
        // Only auto-switch when no conversation is pinned yet.
        // Once pinned, we only update via explicit switchConversation() calls.
        if (!this._conversationPinned && this.activeConversationId !== active.id) {
          console.log(`[Transcript] Active Antigravity Conversation: ${active.id}`);
          this.activeConversationId = active.id;
          this.activeConversationDir = active.fullPath;
          this.transcriptPath = active.tPath;
          this.lastProcessedOffset = 0;
          this.cachedItems = [];
        }
        return active.id;
      }
    } catch (err) {
      console.error(`[Transcript] Error finding active conversation: ${err.message}`);
    }
    return null;
  }

  // Get readable title of active conversation
  getActiveTitle() {
    // 1. From implementation_plan.md
    if (this.cachedPlan) {
      const match = this.cachedPlan.match(/^#\s+(.+)$/m);
      if (match && match[1] && !match[1].includes('[Goal Description]')) {
        return match[1].trim();
      }
    }

    // 2. From first user message
    const firstUser = this.cachedItems.find((i) => i.type === 'user');
    if (firstUser && firstUser.text) {
      const firstLine = firstUser.text.split('\n')[0].trim();
      return firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
    }

    return this.activeConversationId
      ? `Session ${this.activeConversationId.slice(0, 8)}...`
      : 'Antigravity Session';
  }

  // Get full list of all available conversations with titles and timestamps
  getConversationList() {
    try {
      if (!fs.existsSync(this.baseBrainDir)) return [];

      const entries = fs.readdirSync(this.baseBrainDir, { withFileTypes: true });
      const convs = [];

      for (const d of entries) {
        if (!d.isDirectory() || d.name === 'tempmediaStorage' || d.name === 'scratch') continue;

        const convId = d.name;
        const fullPath = path.join(this.baseBrainDir, convId);
        const tPath = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
        const planPath = path.join(fullPath, 'implementation_plan.md');

        if (!fs.existsSync(tPath)) continue;

        const stats = fs.statSync(tPath);
        let title = '';
        let preview = '';

        // Check implementation plan for title
        if (fs.existsSync(planPath)) {
          try {
            const planContent = fs.readFileSync(planPath, 'utf8');
            const match = planContent.match(/^#\s+(.+)$/m);
            if (match && match[1] && !match[1].includes('[Goal Description]')) {
              title = match[1].trim();
            }
          } catch {}
        }

        // Check first user message in transcript
        try {
          const tContent = fs.readFileSync(tPath, 'utf8');
          const lines = tContent.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line.trim());
              if (parsed.type === 'USER_INPUT') {
                let userText = parsed.content || '';
                const m = userText.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
                if (m) userText = m[1].trim();
                userText = userText.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '').trim();
                if (userText) {
                  preview = userText.slice(0, 80);
                  if (!title) {
                    const firstLine = userText.split('\n')[0].trim();
                    title = firstLine.slice(0, 42) + (firstLine.length > 42 ? '...' : '');
                  }
                  break;
                }
              }
            } catch {}
          }
        } catch {}

        if (!title) {
          title = `Session ${convId.slice(0, 8)}`;
        }

        convs.push({
          id: convId,
          title,
          preview,
          isActive: convId === this.activeConversationId,
          updatedAt: stats.mtimeMs,
          updatedFormatted: new Date(stats.mtimeMs).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      }

      return convs.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
      console.error(`[Transcript] Error getting conversation list: ${err.message}`);
      return [];
    }
  }

  // Switch active conversation (called explicitly by user action via UI)
  switchConversation(targetId) {
    if (!targetId) return false;
    const fullPath = path.join(this.baseBrainDir, targetId);
    const tPath = path.join(fullPath, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(tPath)) return false;

    console.log(`[Transcript] Switching to conversation: ${targetId}`);
    this.activeConversationId = targetId;
    this.activeConversationDir = fullPath;
    this.transcriptPath = tPath;
    this.lastProcessedOffset = 0;
    this.cachedItems = [];
    this.cachedPlan = '';
    this.cachedWalkthrough = '';
    // Re-pin to the new conversation so polling stays here
    this._conversationPinned = true;

    // Load full history for this conversation
    this.loadInitialTranscript();
    this.loadArtifacts();

    return true;
  }


  // Parse a single raw JSON line from transcript.jsonl
  parseTranscriptLine(line) {
    if (!line || !line.trim()) return null;
    try {
      const entry = JSON.parse(line.trim());
      const type = entry.type;
      const stepIndex = entry.step_index;
      const timestamp = entry.created_at || new Date().toISOString();

      // 1. User Input
      if (type === 'USER_INPUT') {
        let text = entry.content || '';
        // Extract content inside <USER_REQUEST>...</USER_REQUEST> if present
        const match = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        if (match) {
          text = match[1].trim();
        }
        // Remove system metadata blocks
        text = text.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '').trim();
        text = text.replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/g, '').trim();

        if (!text) return null;

        return {
          id: `step_${stepIndex}_user`,
          stepIndex,
          type: 'user',
          role: 'user',
          text,
          timestamp,
        };
      }

      // 2. Planner / Agent Response
      if (type === 'PLANNER_RESPONSE') {
        const thinking = entry.thinking ? entry.thinking.trim() : null;
        const content = entry.content ? entry.content.trim() : null;
        const toolCalls = Array.isArray(entry.tool_calls)
          ? entry.tool_calls.map((tc) => {
              let parsedArgs = tc.args;
              if (typeof parsedArgs === 'string') {
                try {
                  parsedArgs = JSON.parse(parsedArgs);
                } catch {
                  // Keep as string if parsing fails
                }
              }
              return {
                name: tc.name,
                action: tc.toolAction || (parsedArgs && parsedArgs.toolAction) || tc.name,
                summary: tc.toolSummary || (parsedArgs && parsedArgs.toolSummary) || '',
                args: parsedArgs,
              };
            })
          : [];

        if (!thinking && !content && toolCalls.length === 0) return null;

        return {
          id: `step_${stepIndex}_agent`,
          stepIndex,
          type: 'agent',
          role: 'agent',
          thinking,
          content,
          toolCalls,
          timestamp,
        };
      }

      // 3. Tool Execution Results
      if (
        [
          'RUN_COMMAND',
          'VIEW_FILE',
          'WRITE_TO_FILE',
          'REPLACE_FILE_CONTENT',
          'MULTI_REPLACE_FILE_CONTENT',
          'LIST_DIRECTORY',
          'GREP_SEARCH',
          'SEARCH_WEB',
        ].includes(type)
      ) {
        let summary = '';
        if (type === 'RUN_COMMAND') {
          summary = `Terminal exited with code ${entry.exit_code ?? 0}`;
        } else if (type === 'VIEW_FILE') {
          summary = 'File inspected';
        } else if (type === 'WRITE_TO_FILE' || type === 'REPLACE_FILE_CONTENT') {
          summary = 'File modified';
        } else {
          summary = `${type} completed`;
        }

        return {
          id: `step_${stepIndex}_tool`,
          stepIndex,
          type: 'tool_result',
          role: 'system',
          toolName: type,
          status: entry.status || 'DONE',
          exitCode: entry.exit_code,
          summary,
          timestamp,
        };
      }
    } catch {
      // Ignore unparseable lines
    }
    return null;
  }

  // Load the initial transcript from the beginning
  loadInitialTranscript() {
    if (!this.transcriptPath || !fs.existsSync(this.transcriptPath)) return;

    try {
      const stats = fs.statSync(this.transcriptPath);
      const content = fs.readFileSync(this.transcriptPath, 'utf8');
      const lines = content.split('\n');

      const items = [];
      for (const line of lines) {
        const item = this.parseTranscriptLine(line);
        if (item) items.push(item);
      }

      this.cachedItems = items;
      this.lastProcessedOffset = stats.size;
    } catch (err) {
      console.error(`[Transcript] Error reading initial transcript: ${err.message}`);
    }
  }

  // Load implementation plan and walkthrough artifacts
  loadArtifacts() {
    if (!this.activeConversationDir) return;

    const planPath = path.join(this.activeConversationDir, 'implementation_plan.md');
    const walkthroughPath = path.join(this.activeConversationDir, 'walkthrough.md');

    if (fs.existsSync(planPath)) {
      try {
        this.cachedPlan = fs.readFileSync(planPath, 'utf8');
      } catch {}
    } else {
      this.cachedPlan = '';
    }

    if (fs.existsSync(walkthroughPath)) {
      try {
        this.cachedWalkthrough = fs.readFileSync(walkthroughPath, 'utf8');
      } catch {}
    } else {
      this.cachedWalkthrough = '';
    }
  }

  // Check for new appended lines in transcript.jsonl
  checkForUpdates() {
    // Only call findActiveConversation when no conversation is pinned yet
    // (avoids auto-jumping to a new convo when a prompt is sent from mobile)
    if (!this._conversationPinned) {
      this.findActiveConversation();
      if (this.activeConversationId) {
        this._conversationPinned = true;
        this.loadInitialTranscript();
        this.loadArtifacts();
      }
    }

    if (!this.transcriptPath || !fs.existsSync(this.transcriptPath)) return;

    try {
      const stats = fs.statSync(this.transcriptPath);
      if (stats.size > this.lastProcessedOffset) {
        const stream = fs.createReadStream(this.transcriptPath, {
          start: this.lastProcessedOffset,
          end: stats.size,
          encoding: 'utf8',
        });

        let chunk = '';
        stream.on('data', (data) => {
          chunk += data;
        });

        stream.on('end', () => {
          this.lastProcessedOffset = stats.size;
          const newLines = chunk.split('\n');
          const newItems = [];

          for (const line of newLines) {
            const item = this.parseTranscriptLine(line);
            if (item) {
              newItems.push(item);
              this.cachedItems.push(item);
            }
          }

          if (newItems.length > 0) {
            this.emit('new_items', newItems);
          }
        });

        stream.on('error', (err) => {
          console.error(`[Transcript] Stream read error: ${err.message}`);
        });
      }

      // Check plan artifacts updates
      this.checkArtifactUpdates();
    } catch (err) {
      console.error(`[Transcript] Update check error: ${err.message}`);
    }
  }

  // Check if plan or walkthrough changed
  checkArtifactUpdates() {
    if (!this.activeConversationDir) return;

    const planPath = path.join(this.activeConversationDir, 'implementation_plan.md');
    const walkthroughPath = path.join(this.activeConversationDir, 'walkthrough.md');

    if (fs.existsSync(planPath)) {
      try {
        const current = fs.readFileSync(planPath, 'utf8');
        if (current !== this.cachedPlan) {
          this.cachedPlan = current;
          this.emit('plan_updated', { type: 'implementation_plan', content: current });
        }
      } catch {}
    }

    if (fs.existsSync(walkthroughPath)) {
      try {
        const current = fs.readFileSync(walkthroughPath, 'utf8');
        if (current !== this.cachedWalkthrough) {
          this.cachedWalkthrough = current;
          this.emit('plan_updated', { type: 'walkthrough', content: current });
        }
      } catch {}
    }
  }

  // Start polling / watching for real-time transcript deltas
  startWatching() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Poll every 800ms for near-instant updates on mobile
    this.pollInterval = setInterval(() => {
      this.checkForUpdates();
    }, 800);
  }

  // Get current state snapshot
  getState() {
    return {
      conversationId: this.activeConversationId,
      conversationTitle: this.getActiveTitle(),
      conversations: this.getConversationList(),
      items: this.cachedItems,
      plan: this.cachedPlan,
      walkthrough: this.cachedWalkthrough,
    };
  }


  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

const transcriptService = new TranscriptService();

// Clean up poll interval on process exit
process.on('exit', () => transcriptService.stop());
process.on('SIGINT', () => { transcriptService.stop(); process.exit(0); });
process.on('SIGTERM', () => { transcriptService.stop(); process.exit(0); });

module.exports = transcriptService;

