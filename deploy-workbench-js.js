/**
 * Antigravity Mobile Remote: Direct JS Injection (v7)
 * 
 * Injects the controller directly into workbench.js and jetskiAgent.js ('self' script origin).
 * Bypasses all CSP inline script restrictions and Trusted Types completely.
 */

const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Users\\tanmay Wagh\\AppData\\Local\\Programs\\Antigravity IDE\\resources\\app\\out\\vs\\code\\electron-browser\\workbench';
const extDir = 'C:\\Users\\tanmay Wagh\\.antigravity-ide\\extensions\\joecodecreations.antigravity-automation-1.11.0-universal';

console.log('====================================================');
console.log('⚡ Antigravity Mobile Remote: Direct JS Injection v7');
console.log('====================================================\n');

if (!fs.existsSync(targetDir)) {
  console.error(`❌ Target directory not found: ${targetDir}`);
  process.exit(1);
}

const CONTROLLER_CODE = `
/* --- ANTIGRAVITY MOBILE SMART CONTROLLER v7 START --- */
(function() {
  if (window.__ANTIGRAVITY_CONTROLLER_INSTALLED__) return;
  window.__ANTIGRAVITY_CONTROLLER_INSTALLED__ = true;

  window.__ANTIGRAVITY_SERVER_URL__ = 'http://127.0.0.1:5000';
  window.__ANTIGRAVITY_BRIDGE_URL__ = 'http://127.0.0.1:3000';

  console.log('%c[Antigravity Smart Remote v7] Controller active in workbench.js!', 'color:#10b981;font-weight:bold;font-size:14px;');

  const EXT_URL = 'http://127.0.0.1:5000';
  const BRIDGE_URL = 'http://127.0.0.1:3000';
  let isExecuting = false;
  let lastReportedStep = null;

  // Helper: Extract Lexical editor instance from DOM element or React Fiber
  function getLexicalEditor(editorEl) {
    if (!editorEl) return null;
    if (editorEl.__lexicalEditor) return editorEl.__lexicalEditor;
    const closest = editorEl.closest('[data-lexical-editor="true"]');
    if (closest && closest.__lexicalEditor) return closest.__lexicalEditor;
    const inner = editorEl.querySelector('[data-lexical-editor="true"]');
    if (inner && inner.__lexicalEditor) return inner.__lexicalEditor;

    // React Fiber traversal for lexicalRef or editorRef
    try {
      const fiberKey = Object.keys(editorEl).find(k => k.startsWith('__reactFiber$'));
      if (fiberKey && editorEl[fiberKey]) {
        let cur = editorEl[fiberKey];
        while (cur) {
          if (cur.memoizedProps) {
            if (cur.memoizedProps.lexicalRef?.current) return cur.memoizedProps.lexicalRef.current;
            if (cur.memoizedProps.editorRef?.current) return cur.memoizedProps.editorRef.current;
            if (cur.memoizedProps.editor) return cur.memoizedProps.editor;
          }
          cur = cur.return;
        }
      }
    } catch(e) {}
    return null;
  }

  // Set Lexical AST state directly so React knows the editor is NOT empty
  function setLexicalContent(editorEl, text) {
    const lexical = getLexicalEditor(editorEl);
    if (!lexical) return false;
    try {
      const stateObj = {
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text: text,
                  type: 'text',
                  version: 1
                }
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'paragraph',
              version: 1
            }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1
        }
      };
      const parsed = lexical.parseEditorState(stateObj);
      lexical.setEditorState(parsed);
      lexical.focus();
      console.log('%c[Antigravity Smart Remote v8] Lexical AST set directly!', 'color:#10b981;font-weight:bold;');
      return true;
    } catch(err) {
      console.warn('[Antigravity Smart Remote] setLexicalContent error:', err);
      return false;
    }
  }

  // Dispatch KEY_ENTER_COMMAND directly into Lexical's command registry
  function triggerLexicalSubmit(editorEl) {
    const lexical = getLexicalEditor(editorEl);
    if (!lexical) return false;

    let dispatched = false;
    const fakeEvt = {
      preventDefault: () => {},
      stopPropagation: () => {},
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13
    };

    if (lexical._commands && typeof lexical._commands.entries === 'function') {
      for (const [cmdKey, prioritySets] of lexical._commands.entries()) {
        if (cmdKey && (cmdKey.type === 'KEY_ENTER_COMMAND' || (typeof cmdKey === 'string' && cmdKey.includes('ENTER')))) {
          try {
            const res = lexical.dispatchCommand(cmdKey, fakeEvt);
            if (res) {
              console.log('%c[Antigravity Smart Remote v8] Dispatched KEY_ENTER_COMMAND to Lexical successfully!', 'color:#10b981;font-weight:bold;');
              dispatched = true;
            }
          } catch(e) {}

          // Also execute priority handlers directly if dispatch didn't return true
          if (!dispatched && Array.isArray(prioritySets)) {
            for (const set of prioritySets) {
              if (set && set.size > 0) {
                for (const handler of set) {
                  try {
                    const ret = handler(fakeEvt, lexical);
                    if (ret) {
                      console.log('%c[Antigravity Smart Remote v8] Executed Lexical Enter handler directly!', 'color:#10b981;font-weight:bold;');
                      dispatched = true;
                    }
                  } catch(e) {}
                }
              }
            }
          }
          break;
        }
      }
    }
    return dispatched;
  }

  // 1. Locate Chat Editor (Target the active bottom prompt box)
  function findChatInput() {
    const lexicals = Array.from(document.querySelectorAll('div[contenteditable="true"][data-lexical-editor="true"]'));
    const visibleLexicals = lexicals.filter(el => el.offsetParent !== null);
    if (visibleLexicals.length > 0) {
      // Pick the last visible editor (the prompt box at the bottom of the active conversation)
      return visibleLexicals[visibleLexicals.length - 1];
    }

    const otherLexicals = Array.from(document.querySelectorAll('div[contenteditable="true"][role="textbox"], .antigravity-agent-side-panel div[contenteditable="true"], div[contenteditable="true"]'));
    const visibleOther = otherLexicals.filter(el => el.offsetParent !== null);
    if (visibleOther.length > 0) return visibleOther[visibleOther.length - 1];

    const tas = Array.from(document.querySelectorAll('textarea')).filter(t => t.offsetParent !== null && !t.disabled);
    if (tas.length > 0) return tas[tas.length - 1];

    return document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
  }

  // 2. Locate Send Button (Strictly target the REAL Send message button)
  function findSendButton(editor) {
    const root = editor ? (
      editor.closest('.antigravity-agent-side-panel') ||
      editor.closest('form') ||
      editor.parentElement?.parentElement?.parentElement?.parentElement ||
      editor.parentElement?.parentElement?.parentElement ||
      editor.parentElement?.parentElement
    ) : null;

    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[data-tooltip-id="input-send-button-send-tooltip"]',
      'button[aria-label*="Send message"]',
      '.antigravity-agent-side-panel button[data-testid="send-button"]',
      '.antigravity-agent-side-panel button[aria-label*="Send"]',
      'button[aria-label*="Send"]'
    ];

    if (root) {
      for (const sel of selectors) {
        try {
          const btn = root.querySelector(sel);
          if (btn && btn.offsetParent !== null) return btn;
        } catch(e) {}
      }
    }

    for (const sel of selectors) {
      try {
        const all = Array.from(document.querySelectorAll(sel));
        const visible = all.filter(b => b.offsetParent !== null);
        if (visible.length > 0) return visible[visible.length - 1];
      } catch(e) {}
    }
    return null;
  }

  function invokeReactClick(btn) {
    if (!btn) return false;
    try {
      const propKey = Object.keys(btn).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEvents$'));
      if (propKey && btn[propKey] && typeof btn[propKey].onClick === 'function') {
        console.log('[Antigravity Smart Remote v8] Invoking React onClick directly on Send button!');
        btn[propKey].onClick({
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new MouseEvent('click', { bubbles: true, cancelable: true })
        });
        return true;
      }
    } catch(e) {}

    try {
      const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber$'));
      if (fiberKey && btn[fiberKey]) {
        let cur = btn[fiberKey];
        while (cur) {
          if (cur.memoizedProps && typeof cur.memoizedProps.onClick === 'function') {
            console.log('[Antigravity Smart Remote v8] Invoking Fiber onClick directly on Send button!');
            cur.memoizedProps.onClick({
              preventDefault: () => {},
              stopPropagation: () => {},
              nativeEvent: new MouseEvent('click', { bubbles: true, cancelable: true })
            });
            return true;
          }
          cur = cur.return;
        }
      }
    } catch(e) {}

    try {
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      btn.click();
      return true;
    } catch(e) {}

    return false;
  }

  function triggerEnter(target) {
    if (!target) return;
    try {
      const enterInit = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false
      };
      target.dispatchEvent(new KeyboardEvent('keydown', enterInit));
      target.dispatchEvent(new KeyboardEvent('keypress', enterInit));
      target.dispatchEvent(new KeyboardEvent('keyup', enterInit));
    } catch(e) {}
  }

  // 3. Type into Editor and Submit (Lexical AST + Direct Command Dispatch + Button Click)
  function typeAndSubmitPrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') return false;
    const cleanText = promptText.trim();
    if (!cleanText) return false;

    console.log('%c[Antigravity Smart Remote v8] Injecting prompt: ' + cleanText, 'color:#38bdf8;font-weight:bold;');

    const editor = findChatInput();
    if (!editor) {
      console.warn('[Antigravity Smart Remote] Chat editor not found!');
      return false;
    }

    editor.focus();

    // Step 1: Update Lexical internal AST state directly
    // This is critical because React isInputEmpty state listens to Lexical AST!
    const setViaLexical = setLexicalContent(editor, cleanText);

    // Step 2: DOM fallback / input event dispatch
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
      if (!inserted && !setViaLexical) {
        editor.innerText = cleanText;
      }
      try {
        editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: cleanText }));
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: cleanText }));
      } catch(e) {
        editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      }
    } else {
      editor.value = cleanText;
      editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }

    function doSubmit() {
      // 1. Direct Lexical Command Dispatch (bypasses UI disabled state)
      const lexOk = triggerLexicalSubmit(editor);
      if (lexOk) {
        console.log('%c[Antigravity Smart Remote v8] Submitted via Lexical Command!', 'color:#10b981;font-weight:bold;');
      }

      // 2. Direct React onClick / DOM click on Send Button
      const sendBtn = findSendButton(editor);
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.removeAttribute('disabled');
        const reactOk = invokeReactClick(sendBtn);
        sendBtn.click();
        if (reactOk) {
          console.log('%c[Antigravity Smart Remote v8] Clicked Send Button via React/DOM!', 'color:#10b981;font-weight:bold;');
        }
      }

      // 3. Native Enter KeyboardEvent
      triggerEnter(editor);
    }

    // Multi-stage trigger: 40ms, 120ms, 250ms, 450ms
    setTimeout(doSubmit, 40);
    setTimeout(doSubmit, 120);
    setTimeout(doSubmit, 250);
    setTimeout(doSubmit, 450);

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

  let lastExecutedText = null;
  let lastExecutedTime = 0;

  function shouldExecutePrompt(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    if (!clean || clean === '/run' || clean === '/reject' || clean === '/allow' || clean === '/skip') return false;
    const now = Date.now();
    if (clean === lastExecutedText && (now - lastExecutedTime) < 4000) {
      return false;
    }
    lastExecutedText = clean;
    lastExecutedTime = now;
    return true;
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
              if (shouldExecutePrompt(promptText)) {
                isExecuting = true;
                typeAndSubmitPrompt(promptText);
                setTimeout(() => { isExecuting = false; }, 1000);
                return;
              }
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
        if (shouldExecutePrompt(text)) {
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
/* --- ANTIGRAVITY MOBILE SMART CONTROLLER v7 END --- */
`;

// 1. Patch workbench.js and jetskiAgent.js
const jsFiles = ['workbench.js', 'jetskiAgent.js'];
for (const jsFile of jsFiles) {
  const filePath = path.join(targetDir, jsFile);
  if (!fs.existsSync(filePath)) continue;

  console.log(`📁 Patching JavaScript module: ${jsFile}...`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip any old controller block
  content = content.replace(/\/\* --- ANTIGRAVITY MOBILE SMART CONTROLLER[\s\S]*?CONTROLLER v\d END --- \*\/\s*/gi, '');

  // Append cleanly
  content = content + '\n' + CONTROLLER_CODE;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   ✅ Successfully injected into ${jsFile}!`);
}

// 2. Also ensure permissive CSP in all HTML files
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

const htmlFiles = [
  'workbench.html',
  'workbench-jetski-agent.html',
  'workbench_orig.html',
  'workbench-jetski-agent_orig.html'
];

for (const htmlFile of htmlFiles) {
  const filePath = path.join(targetDir, htmlFile);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  const cspRegex = /<meta\s+http-equiv=["']Content-Security-Policy["'][\s\S]*?\/?\s*>/i;
  if (cspRegex.test(content)) {
    content = content.replace(cspRegex, PERMISSIVE_CSP);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`   ✅ Updated CSP in ${htmlFile}`);
}

console.log('\n====================================================');
console.log('✨ All Done! Both workbench.js & jetskiAgent.js are patched!');
console.log('====================================================\n');
