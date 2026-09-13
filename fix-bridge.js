/**
 * Antigravity Mobile Remote: Smart Controller Patcher v6
 * 
 * 1. Injects native Smart Controller inline inside <body aria-label=""></body> (no external file net::ERR_FILE_NOT_FOUND).
 * 2. Uses Permissive Content Security Policy (CSP) with 'unsafe-inline' so script executes immediately.
 * 3. Exact Facebook Lexical Editor selectors (`div[contenteditable="true"][data-lexical-editor="true"]`).
 * 4. Dual-channel polling (both port 3000 and port 5000).
 * 5. Patches both workbench files AND extension bridge_payload.html.
 */

const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\tanmay Wagh\\AppData\\Local\\Programs\\Antigravity IDE\\resources\\app\\out\\vs\\code\\electron-browser\\workbench';
const extDir = 'C:\\Users\\tanmay Wagh\\.antigravity-ide\\extensions\\joecodecreations.antigravity-automation-1.11.0-universal';
const filesToPatch = ['workbench.html', 'workbench-jetski-agent.html'];

console.log('====================================================');
console.log('⚡ Antigravity Mobile Smart Controller v6: Patcher');
console.log('====================================================\n');

if (!fs.existsSync(targetDir)) {
  console.error(`❌ Target directory not found: ${targetDir}`);
  process.exit(1);
}

const PERMISSIVE_CSP = `<meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src 'self' data: blob: vscode-remote-resource: vscode-managed-remote-resource: https:;
    media-src 'self' data: https://127.0.0.1:* blob: https://www.gstatic.com/;
    frame-src 'self' vscode-webview: data:;
    script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    connect-src 'self' data: http://127.0.0.1:* http://localhost:* https://localhost:* ws: wss: https:;
    font-src 'self' vscode-remote-resource: vscode-managed-remote-resource: https://*.vscode-unpkg.net https://fonts.gstatic.com;
" />`;

const CONTROLLER_INLINE = `<!-- FINAL WORKING Antigravity Bridge v2 -->
<!-- ANTIGRAVITY MOBILE SMART CONTROLLER v6 -->
<script>
window.__ANTIGRAVITY_SERVER_URL__ = 'http://127.0.0.1:5000';
window.__ANTIGRAVITY_BRIDGE_URL__ = 'http://127.0.0.1:3000';

(function() {
  console.log('%c[Antigravity Smart Remote v6] Controller active in workbench!', 'color:#10b981;font-weight:bold;font-size:14px;');

  const EXT_URL = 'http://127.0.0.1:5000';
  const BRIDGE_URL = 'http://127.0.0.1:3000';
  let isExecuting = false;
  let lastReportedStep = null;

  // 1. Locate Chat Editor (Lexical Contenteditable or Textarea)
  function findChatInput() {
    const lexical = document.querySelector('div[contenteditable="true"][data-lexical-editor="true"]')
      || document.querySelector('div[contenteditable="true"][role="textbox"]')
      || document.querySelector('div[contenteditable="true"]')
      || document.querySelector('.antigravity-agent-side-panel div[contenteditable="true"]');
    if (lexical && lexical.offsetParent !== null) return lexical;

    const tas = Array.from(document.querySelectorAll('textarea'));
    const visibleTa = tas.find(t => t.offsetParent !== null && !t.disabled);
    if (visibleTa) return visibleTa;

    return lexical || document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
  }

  // 2. Locate Send Button
  function findSendButton() {
    const selectors = [
      '.absolute.-bottom-1.-left-1.-right-1.-top-1',
      '.antigravity-agent-side-panel button[type="submit"]',
      'button[type="submit"]',
      '.codicon-send',
      'button[aria-label*="Send"]',
      'div[role="button"][aria-label*="Send"]',
      'button[data-tooltip-id="input-send-button-send-tooltip"]'
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el;
      } catch(e) {}
    }
    return null;
  }

  // 3. Type into Editor and Submit
  function typeAndSubmitPrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') return false;
    const cleanText = promptText.trim();
    if (!cleanText) return false;

    console.log('%c[Antigravity Smart Remote] Injecting prompt: ' + cleanText, 'color:#38bdf8;font-weight:bold;');

    const editor = findChatInput();
    if (!editor) {
      console.warn('[Antigravity Smart Remote] Chat editor not found!');
      return false;
    }

    editor.focus();

    if (editor.isContentEditable || editor.getAttribute('contenteditable') === 'true') {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('selectAll', false, null);
      } catch(e) {}

      const inserted = document.execCommand('insertText', false, cleanText);
      if (!inserted) {
        editor.innerText = cleanText;
      }
      editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    } else {
      try {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, cleanText);
      } catch(e) {}
      editor.value = cleanText;
      editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }

    setTimeout(() => {
      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
        console.log('%c[Antigravity Smart Remote] Clicked Send button successfully!', 'color:#10b981;font-weight:bold;');
      } else {
        editor.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
        console.log('%c[Antigravity Smart Remote] Dispatched Enter keydown!', 'color:#10b981;');
      }
    }, 120);

    return true;
  }

  // 4. Detect Interactive Question/Permission Modal
  function detectPendingPermissions() {
    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"], a.action-label, [tabindex="0"]'));
    const submitBtn = allButtons.find(b => {
      const txt = (b.textContent || '').trim();
      return (txt.startsWith('Submit') || txt === 'Submit ↵') && b.offsetParent !== null && !b.disabled;
    });

    const skipBtn = allButtons.find(b => {
      const txt = (b.textContent || '').trim();
      return txt === 'Skip' && b.offsetParent !== null && !b.disabled;
    });

    const runBtn = allButtons.find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return (t === 'run' || t.startsWith('run ') || t.includes('always run') || t === 'allow') && b.offsetParent !== null && !b.disabled;
    });

    const rejectBtn = allButtons.find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return (t === 'reject' || t === 'deny' || t === 'cancel') && b.offsetParent !== null && !b.disabled;
    });

    if (submitBtn) {
      const modal = submitBtn.closest('div[class*="dialog"], div[class*="modal"], div[class*="prompt"], div[role="dialog"], div[class*="step"]') || submitBtn.parentElement.parentElement;

      let title = 'Allow Action?';
      const allTextNodes = modal ? Array.from(modal.querySelectorAll('h1, h2, h3, h4, div, span')) : [];
      const titleEl = allTextNodes.find(el => {
        const t = (el.textContent || '').trim();
        return (t.startsWith('Allow ') || t.endsWith('?')) && el.children.length === 0 && t.length < 120;
      });
      if (titleEl) title = titleEl.textContent.trim();

      let commandText = '';
      const codeEls = modal ? Array.from(modal.querySelectorAll('pre, code, div[class*="code"], div[class*="command"], div[class*="terminal"]')) : [];
      if (codeEls.length > 0) {
        commandText = codeEls[0].textContent.trim();
      } else if (modal) {
        const inner = modal.innerText || modal.textContent || '';
        const lines = inner.split('\\n').map(l => l.trim()).filter(Boolean);
        const cmd = lines.find(l => (l.includes('node') || l.includes('npm') || l.includes('git') || l.length > 25) && !l.includes('Submit') && !l.includes('Skip') && !l.startsWith('Allow'));
        if (cmd) commandText = cmd;
      }

      const options = [];
      const optEls = modal ? Array.from(modal.querySelectorAll('div, li, span')) : [];
      optEls.forEach(el => {
        const t = (el.textContent || '').trim();
        if ((t.startsWith('1 ') || t.startsWith('2 ') || t.startsWith('3 ') || t.startsWith('4 ') || t.includes('Yes, allow') || t.includes('always allow') || t.includes('No (tell')) && el.children.length <= 2) {
          if (!options.some(o => o.includes(t) || t.includes(o))) {
            options.push(t);
          }
        }
      });

      const stepData = {
        hasPending: true,
        isModal: true,
        title: title,
        commandText: commandText || title,
        options: options.length ? options : ['Yes, allow this time', 'Yes, and always allow in this conversation', 'Skip', 'Reject'],
        hasSkip: Boolean(skipBtn),
        timestamp: new Date().toISOString()
      };

      if (!lastReportedStep || lastReportedStep.commandText !== stepData.commandText) {
        lastReportedStep = stepData;
        console.log('%c[Antigravity Smart Remote] Permission modal detected: ' + title, 'color:#f59e0b;font-weight:bold;');
        fetch(BRIDGE_URL + '/api/action/pending_step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stepData)
        }).catch(() => {});
      }
      return;
    }

    if (runBtn) {
      const container = runBtn.closest('div[class*="step"], div[class*="action"], .monaco-list-row') || runBtn.parentElement;
      const text = container ? container.textContent.trim().slice(0, 300) : 'Step requires input';
      
      const stepData = {
        hasPending: true,
        isModal: false,
        title: 'Allow Command Execution?',
        commandText: text,
        hasReject: Boolean(rejectBtn),
        timestamp: new Date().toISOString()
      };

      if (!lastReportedStep || lastReportedStep.commandText !== text) {
        lastReportedStep = stepData;
        console.log('%c[Antigravity Smart Remote] Approval required: ' + text, 'color:#f59e0b;');
        fetch(BRIDGE_URL + '/api/action/pending_step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stepData)
        }).catch(() => {});
      }
      return;
    }

    if (lastReportedStep && lastReportedStep.hasPending) {
      lastReportedStep = { hasPending: false };
      fetch(BRIDGE_URL + '/api/action/pending_step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasPending: false })
      }).catch(() => {});
    }
  }

  // 5. Remote Decision Execution
  function executeRemoteDecision(decision) {
    decision = String(decision || '').toLowerCase().trim();
    console.log('%c[Antigravity Smart Remote] Executing decision: ' + decision, 'color:#38bdf8;font-weight:bold;');

    const allButtons = Array.from(document.querySelectorAll('button, div[role="button"], a.action-label, [tabindex="0"]'));
    const submitBtn = allButtons.find(b => {
      const txt = (b.textContent || '').trim();
      return (txt.startsWith('Submit') || txt === 'Submit ↵') && b.offsetParent !== null && !b.disabled;
    });

    const skipBtn = allButtons.find(b => {
      const txt = (b.textContent || '').trim();
      return txt === 'Skip' && b.offsetParent !== null && !b.disabled;
    });

    if (submitBtn) {
      if (decision === 'skip') {
        if (skipBtn) {
          skipBtn.click();
          return true;
        }
      }
      if (decision === 'reject') {
        if (skipBtn) {
          skipBtn.click();
          return true;
        }
        const allItems = Array.from(document.querySelectorAll('div, span, li, button'));
        const noOpt = allItems.find(el => {
          const t = (el.textContent || '').trim();
          return (t.includes('No (tell the agent') || t.startsWith('4 No')) && el.offsetParent !== null;
        });
        if (noOpt) {
          noOpt.click();
          setTimeout(() => submitBtn.click(), 80);
          return true;
        }
      }
      if (decision === 'always') {
        const allItems = Array.from(document.querySelectorAll('div, span, li, button'));
        const alwaysOpt = allItems.find(el => {
          const t = (el.textContent || '').trim();
          return (t.includes('always allow') && t.includes('conversation')) && el.offsetParent !== null;
        });
        if (alwaysOpt) {
          alwaysOpt.click();
          setTimeout(() => submitBtn.click(), 80);
          return true;
        }
      }

      const allItems = Array.from(document.querySelectorAll('div, span, li, button'));
      const allowOpt = allItems.find(el => {
        const t = (el.textContent || '').trim();
        return (t.includes('Yes, allow this time') || t.includes('allow this time') || t.startsWith('1 Yes')) && el.offsetParent !== null;
      });
      if (allowOpt) allowOpt.click();
      setTimeout(() => {
        submitBtn.click();
        console.log('%c[Antigravity Smart Remote] Submitted permission modal!', 'color:#10b981;font-weight:bold;');
      }, 80);
      return true;
    }

    const runBtn = allButtons.find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return (t === 'run' || t.startsWith('run ') || t.includes('always run') || t === 'allow') && b.offsetParent !== null && !b.disabled;
    });
    const rejectBtn = allButtons.find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return (t === 'reject' || t === 'deny' || t === 'cancel') && b.offsetParent !== null && !b.disabled;
    });

    if (decision === 'run' || decision === 'allow' || decision === 'always' || decision === 'yes') {
      if (runBtn) {
        runBtn.click();
        return true;
      }
    } else if (decision === 'reject' || decision === 'skip') {
      if (rejectBtn) {
        rejectBtn.click();
        return true;
      }
    }
    return false;
  }

  // 6. Polling Loop (every 350ms)
  setInterval(async () => {
    try {
      detectPendingPermissions();

      // Check Bridge Server (localhost:3000) for instant decision
      try {
        const bRes = await fetch(BRIDGE_URL + '/api/action/latest_decision');
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData && bData.latestDecision && bData.latestDecision.decision) {
            const dec = bData.latestDecision.decision;
            fetch(BRIDGE_URL + '/api/action/clear_decision', { method: 'POST' }).catch(() => {});
            executeRemoteDecision(dec);
            return;
          }
        }
      } catch(e) {}

      // Check Bridge Server (localhost:3000) for prompt
      if (!isExecuting) {
        try {
          const pRes = await fetch(BRIDGE_URL + '/api/prompt/latest');
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData && pData.latestPrompt && pData.latestPrompt.prompt) {
              const promptText = pData.latestPrompt.prompt;
              fetch(BRIDGE_URL + '/api/prompt/clear', { method: 'POST' }).catch(() => {});
              isExecuting = true;
              typeAndSubmitPrompt(promptText);
              setTimeout(() => { isExecuting = false; }, 1000);
              return;
            }
          }
        } catch(e) {}
      }

      // Check Port 5000
      if (isExecuting) return;
      try {
        const res = await fetch(EXT_URL + '/get_command');
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;

        if (data.action === 'run_command' || data.decision) {
          executeRemoteDecision(data.decision || 'run');
          return;
        }
        if (data.action === 'reject_command') {
          executeRemoteDecision('reject');
          return;
        }

        const text = data.text || data.command;
        if (text && typeof text === 'string' && text.trim() && text !== '/run' && text !== '/reject' && text !== '/allow') {
          isExecuting = true;
          typeAndSubmitPrompt(text);
          setTimeout(() => { isExecuting = false; }, 1000);
        }
      } catch(e) {}
    } catch(err) {}
  }, 350);

  // 7. DEVTOOLS CONSOLE TEST HELPERS
  const testHelper = function(testText) {
    const text = testText || 'Test prompt from Developer Tools!';
    console.log('[Antigravity Smart Remote] Testing injection with:', text);
    return typeAndSubmitPrompt(text);
  };

  window.__testPrompt = testHelper;
  window.testPrompt = testHelper;
  if (typeof globalThis !== 'undefined') {
    globalThis.__testPrompt = testHelper;
    globalThis.testPrompt = testHelper;
  }
  try {
    if (window.top && window.top !== window) {
      window.top.__testPrompt = testHelper;
      window.top.testPrompt = testHelper;
    }
  } catch(e) {}

  window.__testFindEditor = function() {
    const ed = findChatInput();
    console.log('[Antigravity Smart Remote] Found editor:', ed);
    return ed;
  };

  window.__testFindSendBtn = function() {
    const btn = findSendButton();
    console.log('[Antigravity Smart Remote] Found send button:', btn);
    return btn;
  };

  window.__testStatus = function() {
    return {
      status: 'active',
      hasEditor: Boolean(findChatInput()),
      hasSendBtn: Boolean(findSendButton()),
      editorElement: findChatInput(),
      extUrl: EXT_URL,
      bridgeUrl: BRIDGE_URL
    };
  };

  console.log('%c[Antigravity Smart Remote] SUCCESS: window.__testPrompt("hello") is ready!', 'color:#a855f7;font-weight:bold;');
})();
</script>
`;

for (const fileName of filesToPatch) {
  const filePath = path.join(targetDir, fileName);
  if (!fs.existsSync(filePath)) continue;

  console.log(`📁 Patching ${fileName}...`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace strict CSP with permissive CSP
  const cspRegex = /<meta\s+http-equiv=["']Content-Security-Policy["'][\s\S]*?\/?\s*>/i;
  if (cspRegex.test(content)) {
    content = content.replace(cspRegex, PERMISSIVE_CSP);
    console.log(`   ✅ Replaced CSP meta tag`);
  }

  // Clean out any old injections or external scripts
  content = content.replace(/<!--\s*FINAL WORKING Antigravity Bridge[\s\S]*?<\/script>\s*/gi, '');
  content = content.replace(/<!--\s*ANTIGRAVITY MOBILE SMART CONTROLLER[\s\S]*?<\/script>\s*/gi, '');
  content = content.replace(/<script src="\.\/smart-remote-bridge\.js"><\/script>\s*/gi, '');

  // Inject cleanly inside <body aria-label=""> ... </body>
  if (content.includes('</body>')) {
    content = content.replace('</body>', CONTROLLER_INLINE + '\n</body>');
  } else {
    content += '\n' + CONTROLLER_INLINE;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   🎉 Successfully updated ${fileName}!\n`);
}

// Also update extension's bridge_payload.html so it stays in sync
if (fs.existsSync(extDir)) {
  const payloadPath = path.join(extDir, 'bridge_payload.html');
  if (fs.existsSync(payloadPath)) {
    fs.writeFileSync(payloadPath, CONTROLLER_INLINE, 'utf8');
    console.log(`📁 Updated extension bridge_payload.html`);
  }
}

console.log('====================================================');
console.log('✨ All Done! How to test in Antigravity IDE:');
console.log('1. In Antigravity IDE: Press Ctrl+Shift+P -> "Reload Window" -> Enter');
console.log('2. In your DevTools Console (which is already open!), type:');
console.log('   window.__testPrompt("hello from test!")');
console.log('====================================================\n');
