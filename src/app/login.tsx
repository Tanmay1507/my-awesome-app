import React, { useState } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const { user, serverUrl, setServerUrl, devLogin, isLoading } = useAuth();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [usernameInput, setUsernameInput] = useState('tanmay1507');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDevLogin = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    setServerUrl(inputUrl);

    const res = await devLogin(usernameInput, 'Tanmay Wagh', `usr_${usernameInput}`);
    setIsSubmitting(false);

    if (res.success) {
      router.replace('/pair');
    } else {
      setErrorMsg(res.error || 'Authentication failed');
    }
  };

  const handleGitHubOAuth = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    setServerUrl(inputUrl);

    // Perform login with selected account
    const res = await devLogin(usernameInput, 'Tanmay Wagh', `usr_${usernameInput}`);
    setIsSubmitting(false);

    if (res.success) {
      router.replace('/pair');
    } else {
      setErrorMsg(res.error || 'GitHub login failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo / Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>⚡</Text>
            </View>
            <Text style={styles.title}>Antigravity Remote</Text>
            <Text style={styles.subtitle}>
              Secure bidirectional relay for your local IDE agent
            </Text>
          </View>

          {/* Server Endpoint Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>RELAY SERVER ENDPOINT</Text>
            <TextInput
              style={styles.input}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.1.15:3000 or tunnel URL"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hintText}>
              Set to your desktop LAN IP or public Cloudflare Tunnel URL.
            </Text>
          </View>

          {/* GitHub Account Selector */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>GITHUB USERNAME / ACCOUNT</Text>
            <TextInput
              style={styles.input}
              value={usernameInput}
              onChangeText={setUsernameInput}
              placeholder="e.g. tanmay1507"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hintText}>
              Must match the GitHub account configured in your local desktop agent.
            </Text>
          </View>

          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.githubButton}
            onPress={handleGitHubOAuth}
            disabled={isSubmitting || isLoading}
            activeOpacity={0.8}>
            {isSubmitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.githubIcon}>🐙</Text>
                <Text style={styles.githubButtonText}>Continue with GitHub</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleDevLogin}
            disabled={isSubmitting || isLoading}
            activeOpacity={0.7}>
            <Text style={styles.secondaryButtonText}>Quick Sign-In as {usernameInput}</Text>
          </TouchableOpacity>

          {/* Architecture Security Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🔒 Security & Pairing Protocol</Text>
            <Text style={styles.infoBullet}>• Local agent authenticates via unique device token</Text>
            <Text style={styles.infoBullet}>• Relay verifies matching GitHub accounts on both ends</Text>
            <Text style={styles.infoBullet}>• Ephemeral 90-second pairing code binds scoped 24h session</Text>
            <Text style={styles.infoBullet}>• Live bidirectional WSS streaming with zero open ports</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  hintText: {
    fontSize: 12,
    color: '#52525b',
    marginTop: 6,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 18,
  },
  githubButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  githubIcon: {
    fontSize: 18,
  },
  githubButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    color: '#d4d4d8',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#0a0a0c',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 14,
    padding: 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  infoBullet: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 18,
    marginBottom: 4,
  },
});
