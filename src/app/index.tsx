import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Vibration,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Spacing } from '@/constants/theme';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  text: string;
  timestamp: string;
  details?: string;
}

interface PendingStep {
  hasPending: boolean;
  isModal?: boolean;
  title?: string;
  commandText?: string;
  options?: string[];
  hasSkip?: boolean;
  hasReject?: boolean;
}

interface ConversationItem {
  id: string;
  title: string;
  preview?: string;
  isActive: boolean;
  updatedAt?: number;
  updatedFormatted?: string;
}

export default function AntigravityRemoteScreen() {
  // Determine default server base URL
  const getDefaultServerUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      return `http://${ip}:3000`;
    }
    return 'http://10.76.102.117:3000';
  };

  const [serverUrl, setServerUrl] = useState(getDefaultServerUrl());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configUrlInput, setConfigUrlInput] = useState(serverUrl);

  const [isConnected, setIsConnected] = useState(false);
  const [autoRun, setAutoRun] = useState(false);

  // Multi-Agent Conversation State
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [activeConversation, setActiveConversation] = useState<string>('Active Session');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const [promptText, setPromptText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'system',
      text: '⚡ Antigravity Smart Remote connected to PC Agent. Ready for commands.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [pendingStep, setPendingStep] = useState<PendingStep | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Helper to map transcript items to Message objects
  const mapItemsToMessages = (items: any[]): Message[] => {
    if (!Array.isArray(items)) return [];
    const result: Message[] = [];

    for (const item of items) {
      const timeStr = item.timestamp
        ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      if (item.type === 'user') {
        result.push({
          id: item.id || `user-${item.timestamp}-${Math.random()}`,
          role: 'user',
          text: item.text || '',
          timestamp: timeStr,
        });
      } else if (item.type === 'agent') {
        const content = item.content;
        const thinking = item.thinking;
        const toolCalls = item.toolCalls;

        if (content) {
          result.push({
            id: item.id || `agent-${item.timestamp}-${Math.random()}`,
            role: 'agent',
            text: content,
            timestamp: timeStr,
          });
        } else if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
          const firstTool = toolCalls[0];
          result.push({
            id: item.id || `tool-${item.timestamp}-${Math.random()}`,
            role: 'tool',
            text: `Executing: ${firstTool.action || firstTool.summary || firstTool.name}`,
            details: firstTool.summary || (firstTool.args ? JSON.stringify(firstTool.args).slice(0, 100) : ''),
            timestamp: timeStr,
          });
        } else if (thinking) {
          result.push({
            id: item.id || `thinking-${item.timestamp}-${Math.random()}`,
            role: 'agent',
            text: `Thinking: ${thinking.slice(0, 160)}...`,
            timestamp: timeStr,
          });
        }
      } else if (item.type === 'tool_result') {
        result.push({
          id: item.id || `toolres-${item.timestamp}-${Math.random()}`,
          role: 'system',
          text: item.summary || `${item.toolName || 'Action'} completed`,
          timestamp: timeStr,
        });
      }
    }

    // Return the latest 60 messages to guarantee 60fps scrolling on mobile
    return result.slice(-60);
  };

  // Fetch the active conversation session & conversation list
  const fetchActiveSession = async () => {
    try {
      setIsLoadingSession(true);
      const res = await fetch(`${serverUrl}/api/canvas/session`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.conversationId) setActiveConversationId(data.conversationId);
          if (data.conversationTitle) setActiveConversation(data.conversationTitle);
          if (data.conversations && Array.isArray(data.conversations)) {
            setConversations(data.conversations);
          }
          if (data.items && Array.isArray(data.items)) {
            const mapped = mapItemsToMessages(data.items);
            if (mapped.length > 0) {
              setMessages(mapped);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Remote] Failed to fetch active session:', e);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Fetch list of conversations
  const fetchConversations = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/canvas/conversations`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          if (data.activeTitle) setActiveConversation(data.activeTitle);
          if (data.activeId) setActiveConversationId(data.activeId);
        }
      }
    } catch (e) {
      console.warn('[Remote] Failed to fetch conversations:', e);
    }
  };

  // Switch to selected conversation
  const handleSwitchConversation = async (convId: string) => {
    try {
      Vibration.vibrate(20);
      setIsLoadingSession(true);
      setShowConversationModal(false);

      // Isolate view immediately - clear out other conversation messages
      setMessages([
        {
          id: `switching-${Date.now()}`,
          role: 'system',
          text: '🔄 Loading selected conversation...',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      const res = await fetch(`${serverUrl}/api/canvas/switch/${convId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveConversationId(data.conversationId);
          setActiveConversation(data.conversationTitle);
          if (data.items && Array.isArray(data.items)) {
            const mapped = mapItemsToMessages(data.items);
            setMessages(
              mapped.length > 0
                ? mapped
                : [
                    {
                      id: `empty-${Date.now()}`,
                      role: 'system',
                      text: `Switched to: ${data.conversationTitle}. Ready for prompts.`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ]
            );
          }
        }
      }
    } catch (e) {
      console.error('Failed to switch conversation:', e);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Start a new Multi-Agent Conversation remotely
  const handleStartNewChat = async () => {
    try {
      Vibration.vibrate(30);
      setShowConversationModal(false);
      setIsLoadingSession(true);

      setMessages([
        {
          id: `new-${Date.now()}`,
          role: 'system',
          text: '✨ Initiating new multi-agent conversation in Antigravity IDE...',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      const res = await fetch(`${serverUrl}/api/canvas/new`, { method: 'POST' });
      if (res.ok) {
        // Wait 1.2s for IDE to initialize new session folder
        setTimeout(() => {
          fetchActiveSession();
          fetchConversations();
        }, 1200);
      }
    } catch (e) {
      console.error('Failed to create new chat:', e);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Connect WebSocket & start listeners
  useEffect(() => {
    let isMounted = true;

    // Load active session immediately
    fetchActiveSession();
    fetchConversations();

    const connectWS = () => {
      try {
        const wsUrl = serverUrl.replace(/^http/, 'ws');
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'bridge_init') {
              if (data.conversationId) setActiveConversationId(data.conversationId);
              if (data.conversationTitle) setActiveConversation(data.conversationTitle);
              if (data.conversations && Array.isArray(data.conversations)) {
                setConversations(data.conversations);
              }
              if (data.toggles) setAutoRun(Boolean(data.toggles.auto_run));
              if (data.canvasItems && Array.isArray(data.canvasItems)) {
                const mapped = mapItemsToMessages(data.canvasItems);
                if (mapped.length > 0) setMessages(mapped);
              }
            }

            if (data.type === 'conversation_switched') {
              if (data.conversationId) setActiveConversationId(data.conversationId);
              if (data.conversationTitle) setActiveConversation(data.conversationTitle);
              if (data.conversations && Array.isArray(data.conversations)) {
                setConversations(data.conversations);
              }
              if (data.canvasItems && Array.isArray(data.canvasItems)) {
                const mapped = mapItemsToMessages(data.canvasItems);
                setMessages(
                  mapped.length > 0
                    ? mapped
                    : [
                        {
                          id: `switched-${Date.now()}`,
                          role: 'system',
                          text: `Switched to: ${data.conversationTitle}`,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                      ]
                );
              }
            }

            if (data.type === 'transcript_items' && Array.isArray(data.items)) {
              const newMapped = mapItemsToMessages(data.items);
              if (newMapped.length > 0) {
                setMessages((prev) => {
                  const existingIds = new Set(prev.map((m) => m.id));
                  const filteredNew = newMapped.filter((m) => !existingIds.has(m.id));
                  return [...prev, ...filteredNew].slice(-60);
                });
              }
            }

            if (data.type === 'user_prompt') {
              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now()),
                  role: 'user',
                  text: data.prompt,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }

            if (data.type === 'agent_stream' || data.type === 'agent_message') {
              const text = data.text || data.delta || data.content;
              if (text) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: String(Date.now()),
                    role: 'agent',
                    text: text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
              }
            }

            if (data.type === 'tool_call') {
              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now()),
                  role: 'tool',
                  text: `Executing tool: ${data.name || 'Terminal Command'}`,
                  details: data.input ? JSON.stringify(data.input) : '',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }

            if (data.type === 'pending_permission') {
              if (data.step && data.step.hasPending) {
                setPendingStep(data.step);
                try {
                  Vibration.vibrate([0, 80, 50, 80]);
                } catch (_) {}
              } else {
                setPendingStep(null);
              }
            }

            if (data.type === 'permission_decision_made') {
              setPendingStep(null);
            }

            if (data.type === 'toggles_updated' && typeof data.auto_run === 'boolean') {
              setAutoRun(data.auto_run);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          setTimeout(connectWS, 3000);
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
        };

        wsRef.current = ws;
      } catch (err) {
        setIsConnected(false);
      }
    };

    connectWS();

    // Secondary poll for pending permission modal every 1200ms
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${serverUrl}/api/action/pending_step`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.pendingStep && data.pendingStep.hasPending) {
            setPendingStep(data.pendingStep);
          } else {
            setPendingStep((prev) => (prev?.hasPending ? null : prev));
          }
        }
      } catch (_) {}
    }, 1200);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [serverUrl]);

  // Scroll to bottom on new message
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, pendingStep]);

  // Send Prompt to PC Agent
  const handleSendPrompt = async () => {
    if (!promptText.trim() || isSubmitting) return;
    const text = promptText.trim();
    setPromptText('');
    setIsSubmitting(true);

    try {
      Vibration.vibrate(15);
    } catch (_) {}

    // Optimistic user bubble
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      const res = await fetch(`${serverUrl}/api/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (!data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            role: 'system',
            text: `⚠️ Prompt Notice: ${data.error || 'Forwarded to queue'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'system',
          text: `⚠️ Network error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Remote Permission Decision (Allow, Always, Skip, Reject)
  const handleDecision = async (decision: 'allow' | 'always' | 'skip' | 'reject') => {
    try {
      Vibration.vibrate(25);
    } catch (_) {}

    setPendingStep(null);

    try {
      await fetch(`${serverUrl}/api/action/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'system',
          text: `✅ Action approved: ${decision.toUpperCase()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('Failed to send decision:', err);
    }
  };

  // Toggle Auto-Run
  const handleToggleAutoRun = async () => {
    try {
      Vibration.vibrate(20);
      const res = await fetch(`${serverUrl}/api/action/auto_run`, { method: 'POST' });
      const data = await res.json();
      if (typeof data.auto_run === 'boolean') {
        setAutoRun(data.auto_run);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Action
  const handleQuickAction = async (actionName: string) => {
    try {
      Vibration.vibrate(15);
      await fetch(`${serverUrl}/api/action/${actionName}`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* HEADER BAR & CONVERSATION SWITCHER TRIGGER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            activeOpacity={0.7}
            onPress={() => {
              fetchConversations();
              setShowConversationModal(true);
            }}>
            <View style={[styles.statusDot, isConnected ? styles.dotGreen : styles.dotRed]} />
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.appTitle}>Antigravity AI</Text>
                <View style={styles.switcherBadge}>
                  <Text style={styles.switcherBadgeText}>⇄ Switch Chat</Text>
                </View>
              </View>
              <View style={styles.activeConvoRow}>
                <Text style={styles.conversationSubtitle} numberOfLines={1}>
                  {activeConversation}
                </Text>
                <Text style={styles.chevronDown}>▼</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serverBadge}
            onPress={() => {
              setConfigUrlInput(serverUrl);
              setShowConfigModal(true);
            }}>
            <Text style={styles.serverBadgeText}>
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* QUICK ACTION BAR */}
        <View style={styles.quickBar}>
          <TouchableOpacity
            style={[styles.quickChip, autoRun ? styles.chipGreen : styles.chipDim]}
            onPress={handleToggleAutoRun}>
            <Text style={[styles.quickChipText, autoRun ? styles.textGreen : styles.textDim]}>
              Auto-Run: {autoRun ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => {
              fetchConversations();
              setShowConversationModal(true);
            }}>
            <Text style={styles.quickChipText}>📁 All Chats ({conversations.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => handleQuickAction('run_pending')}>
            <Text style={styles.quickChipText}>▶ Run Pending</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickChip}
            onPress={() => handleQuickAction('reject_pending')}>
            <Text style={styles.quickChipText}>✕ Reject</Text>
          </TouchableOpacity>
        </View>

        {/* INTERACTIVE PERMISSION MODAL / CARD */}
        {pendingStep && pendingStep.hasPending && (
          <View style={styles.permissionCard}>
            <View style={styles.permissionHeader}>
              <View style={styles.pulseDot} />
              <Text style={styles.permissionTitle}>
                {pendingStep.title || 'Allow Command Execution?'}
              </Text>
            </View>

            <View style={styles.codeContainer}>
              <Text style={styles.codeText} numberOfLines={4}>
                {pendingStep.commandText || 'Action requires approval'}
              </Text>
            </View>

            <View style={styles.decisionRow}>
              <TouchableOpacity
                style={[styles.decisionBtn, styles.btnAllow]}
                onPress={() => handleDecision('allow')}>
                <Text style={styles.btnTextBold}>✓ Yes, allow</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.decisionBtn, styles.btnAlways]}
                onPress={() => handleDecision('always')}>
                <Text style={styles.btnTextLight}>🛡 Always</Text>
              </TouchableOpacity>

              {pendingStep.hasSkip && (
                <TouchableOpacity
                  style={[styles.decisionBtn, styles.btnSkip]}
                  onPress={() => handleDecision('skip')}>
                  <Text style={styles.btnTextLight}>Skip</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.decisionBtn, styles.btnReject]}
                onPress={() => handleDecision('reject')}>
                <Text style={styles.btnTextReject}>✕ Deny</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONVERSATION & ACTIVITY FEED (ISOLATED TO ACTIVE CONVERSATION) */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.feedScroll}
          contentContainerStyle={styles.feedContent}>
          {isLoadingSession && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingBannerText}>Syncing conversation...</Text>
            </View>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isTool = msg.role === 'tool';
            const isSystem = msg.role === 'system';

            return (
              <View
                key={msg.id}
                style={[
                  styles.msgWrapper,
                  isUser ? styles.msgRight : styles.msgLeft,
                ]}>
                <View
                  style={[
                    styles.msgBubble,
                    isUser
                      ? styles.bubbleUser
                      : isTool
                      ? styles.bubbleTool
                      : isSystem
                      ? styles.bubbleSystem
                      : styles.bubbleAgent,
                  ]}>
                  <Text
                    style={[
                      styles.msgText,
                      isUser ? styles.textUser : isSystem ? styles.textSystem : styles.textAgent,
                    ]}>
                    {msg.text}
                  </Text>
                  {msg.details ? (
                    <Text style={styles.msgDetails}>{msg.details}</Text>
                  ) : null}
                  <Text style={styles.msgTime}>{msg.timestamp}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* PROMPT INPUT BAR */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={promptText}
            onChangeText={setPromptText}
            placeholder={`Message in ${activeConversation.slice(0, 18)}...`}
            placeholderTextColor="#71717a"
            multiline
            maxLength={2000}
            onSubmitEditing={handleSendPrompt}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              promptText.trim().length === 0 || isSubmitting
                ? styles.sendButtonDisabled
                : styles.sendButtonActive,
            ]}
            disabled={promptText.trim().length === 0 || isSubmitting}
            onPress={handleSendPrompt}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.sendButtonText}>▲</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MULTI-AGENT CONVERSATION SWITCHER MODAL */}
        <Modal visible={showConversationModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.convoModalCard}>
              <View style={styles.convoModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Antigravity Conversations</Text>
                  <Text style={styles.modalSubtitle}>
                    Multi-agent sessions & branch explorer
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setShowConversationModal(false)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Start New Conversation Action */}
              <TouchableOpacity
                style={styles.newChatBtn}
                activeOpacity={0.8}
                onPress={handleStartNewChat}>
                <View style={styles.newChatIconBox}>
                  <Text style={styles.newChatBtnIcon}>＋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.newChatBtnTitle}>Start New Conversation</Text>
                  <Text style={styles.newChatBtnSubtitle}>Create a fresh multi-agent session</Text>
                </View>
                <Text style={styles.newChatBtnArrow}>→</Text>
              </TouchableOpacity>

              {/* List of Available Conversations */}
              <View style={styles.convoSectionHeader}>
                <Text style={styles.convoSectionTitle}>
                  AVAILABLE SESSIONS ({conversations.length})
                </Text>
              </View>

              <ScrollView
                style={styles.convoListScroll}
                showsVerticalScrollIndicator={false}>
                {conversations.map((c) => {
                  const isCurrent = c.id === activeConversationId || c.isActive;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.convoItem, isCurrent && styles.convoItemActive]}
                      activeOpacity={0.7}
                      onPress={() => handleSwitchConversation(c.id)}>
                      <View style={styles.convoItemHeader}>
                        <View style={styles.convoItemTitleRow}>
                          {isCurrent && <View style={styles.activeDot} />}
                          <Text
                            style={[
                              styles.convoItemTitle,
                              isCurrent && styles.convoItemTitleActive,
                            ]}
                            numberOfLines={1}>
                            {c.title || `Session ${c.id.slice(0, 8)}`}
                          </Text>
                        </View>
                        {isCurrent ? (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>ACTIVE</Text>
                          </View>
                        ) : (
                          <Text style={styles.convoItemTime}>
                            {c.updatedFormatted || ''}
                          </Text>
                        )}
                      </View>
                      {c.preview ? (
                        <Text style={styles.convoItemPreview} numberOfLines={2}>
                          {c.preview}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* SERVER CONFIG MODAL */}
        <Modal visible={showConfigModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>PC Bridge Server URL</Text>
              <Text style={styles.modalSubtitle}>
                Enter the IP address and port of your PC running Antigravity IDE:
              </Text>
              <TextInput
                style={styles.modalInput}
                value={configUrlInput}
                onChangeText={setConfigUrlInput}
                placeholder="http://192.168.1.xxx:3000"
                placeholderTextColor="#71717a"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setShowConfigModal(false)}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnSave]}
                  onPress={() => {
                    setServerUrl(configUrlInput.trim());
                    setShowConfigModal(false);
                  }}>
                  <Text style={styles.modalBtnTextBold}>Save & Connect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#09090b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  switcherBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  switcherBadgeText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '700',
  },
  activeConvoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  conversationSubtitle: {
    color: '#a1a1aa',
    fontSize: 11,
    maxWidth: 210,
  },
  chevronDown: {
    color: '#71717a',
    fontSize: 9,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  serverBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  serverBadgeText: {
    color: '#d4d4d8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#111114',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  chipGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  chipDim: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  textGreen: {
    color: '#34d399',
  },
  textDim: {
    color: '#71717a',
  },
  permissionCard: {
    marginHorizontal: Spacing.four,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#1c1708',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
  },
  permissionTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  codeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  codeText: {
    color: '#fef08a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  decisionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  decisionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAllow: {
    backgroundColor: '#10b981',
    flex: 2,
    minWidth: 110,
  },
  btnAlways: {
    backgroundColor: '#2563eb',
    flex: 1,
    minWidth: 75,
  },
  btnSkip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flex: 1,
    minWidth: 50,
  },
  btnReject: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    flex: 1,
    minWidth: 55,
  },
  btnTextBold: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  btnTextLight: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  btnTextReject: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  feedScroll: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: 10,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  loadingBannerText: {
    color: '#93c5fd',
    fontSize: 12,
  },
  msgWrapper: {
    flexDirection: 'row',
  },
  msgRight: {
    justifyContent: 'flex-end',
  },
  msgLeft: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
  },
  bubbleUser: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 2,
  },
  bubbleAgent: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 2,
  },
  bubbleTool: {
    backgroundColor: '#131926',
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  bubbleSystem: {
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  textUser: {
    color: '#ffffff',
  },
  textAgent: {
    color: '#f4f4f5',
  },
  textSystem: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  msgDetails: {
    color: '#93c5fd',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
  msgTime: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingVertical: 10,
    backgroundColor: '#111114',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#1c1c20',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#3b82f6',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#a1a1aa',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  modalInput: {
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalBtnCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalBtnSave: {
    backgroundColor: '#3b82f6',
  },
  modalBtnText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBtnTextBold: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Multi-Agent Conversation Modal Styles
  convoModalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#141417',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  convoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#d4d4d8',
    fontSize: 14,
    fontWeight: '700',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  newChatIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatBtnIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  newChatBtnTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  newChatBtnSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  newChatBtnArrow: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '700',
  },
  convoSectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 8,
    marginBottom: 10,
  },
  convoSectionTitle: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  convoListScroll: {
    maxHeight: 320,
  },
  convoItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  convoItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  convoItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convoItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  convoItemTitle: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  convoItemTitleActive: {
    color: '#34d399',
    fontWeight: '700',
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  activePillText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  convoItemTime: {
    color: '#71717a',
    fontSize: 10,
  },
  convoItemPreview: {
    color: '#a1a1aa',
    fontSize: 11,
    lineHeight: 15,
  },
});
