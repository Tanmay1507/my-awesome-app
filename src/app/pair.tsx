import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';

export default function PairScreen() {
  const router = useRouter();
  const { user, session, pairWithCode, logout, serverUrl } = useAuth();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(90);

  const inputRef = useRef<TextInput>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 90-second countdown simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 1 ? prev - 1 : 90));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // If already paired, redirect to dashboard
  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session]);

  const handlePair = async () => {
    if (!code || code.trim().length < 6) {
      setErrorMsg('Please enter all 6 digits of the pairing code.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const res = await pairWithCode(code.trim());
    setIsSubmitting(false);

    if (res.success) {
      router.replace('/');
    } else {
      setErrorMsg(res.error || 'Pairing verification failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* User Profile Badge */}
          {user && (
            <View style={styles.userBadge}>
              <Text style={styles.userIcon}>👤</Text>
              <View>
                <Text style={styles.userName}>{user.name || user.username}</Text>
                <Text style={styles.userHandle}>@{user.username} • {user.id}</Text>
              </View>
              <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                <Text style={styles.logoutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🔗</Text>
            </View>
            <Text style={styles.title}>Pair with Desktop Agent</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit ephemeral code displayed in your desktop terminal:
            </Text>
          </View>

          {/* 6-Digit Code Box */}
          <View style={styles.codeContainer}>
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
                setCode(cleaned);
                if (cleaned.length === 6) {
                  setErrorMsg(null);
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              style={styles.boxesRow}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}>
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const digit = code[index] || '';
                const isFocused = code.length === index || (code.length === 6 && index === 5);
                return (
                  <View
                    key={index}
                    style={[
                      styles.codeBox,
                      isFocused && styles.codeBoxFocused,
                      digit ? styles.codeBoxFilled : null,
                    ]}>
                    <Text style={styles.digitText}>{digit}</Text>
                  </View>
                );
              })}
            </TouchableOpacity>
          </View>

          {/* Countdown timer */}
          <View style={styles.timerRow}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>
              Code refreshes in <Text style={styles.timerHighlight}>{secondsRemaining}s</Text>
            </Text>
          </View>

          {/* Error message */}
          {errorMsg && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>⚠️ Verification Failed</Text>
              <Text style={styles.errorDesc}>{errorMsg}</Text>
            </View>
          )}

          {/* Action button */}
          <TouchableOpacity
            style={[styles.pairButton, code.length === 6 ? styles.pairButtonActive : null]}
            onPress={handlePair}
            disabled={isSubmitting || code.length < 6}
            activeOpacity={0.8}>
            {isSubmitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.pairButtonText}>
                {code.length === 6 ? 'Verify & Create 24h Session' : 'Enter 6 Digits to Pair'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Instructions */}
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>🖥️ Where do I find the code?</Text>
            <Text style={styles.helpStep}>1. Start your local bridge server on your computer:</Text>
            <View style={styles.codeSnippet}>
              <Text style={styles.snippetText}>npm run server</Text>
            </View>
            <Text style={styles.helpStep}>
              2. Look for the <Text style={{ color: '#10b981', fontWeight: 'bold' }}>🔑 6-Digit Pairing Code</Text> in the terminal output.
            </Text>
            <Text style={styles.helpStep}>
              3. Connected server: <Text style={{ color: '#ffffff' }}>{serverUrl}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 24,
    gap: 10,
  },
  userIcon: {
    fontSize: 20,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  userHandle: {
    fontSize: 12,
    color: '#71717a',
  },
  logoutBtn: {
    marginLeft: 'auto',
    backgroundColor: '#18181b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b98115',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 18,
  },
  codeContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  codeBox: {
    width: 46,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#09090b',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFocused: {
    borderColor: '#10b981',
    backgroundColor: '#18181b',
  },
  codeBoxFilled: {
    borderColor: 'rgba(16,185,129,0.5)',
  },
  digitText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  timerText: {
    fontSize: 13,
    color: '#71717a',
  },
  timerHighlight: {
    color: '#10b981',
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorDesc: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 17,
  },
  pairButton: {
    backgroundColor: '#27272a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pairButtonActive: {
    backgroundColor: '#10b981',
  },
  pairButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  helpCard: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
  },
  helpTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e4e4e7',
    marginBottom: 8,
  },
  helpStep: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 18,
    marginBottom: 6,
  },
  codeSnippet: {
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
  },
  snippetText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#10b981',
    fontSize: 12,
  },
});
