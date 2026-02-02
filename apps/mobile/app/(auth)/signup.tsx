import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { COLORS } from "../../lib/utils";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSignup = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password) {
      setError("Please enter a password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await signUp(email.trim(), password);
    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      // If email confirmation is enabled, user won't have an active session yet.
      // Show a success message so they know to check their email.
      setSuccess(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>ITEMIZE IT</Text>
            <Text style={styles.tagline}>
              Create your account to get started.
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.cardTitle}>Check your email</Text>
                <Text style={styles.cardDescription}>
                  We sent a confirmation link to verify your account.
                </Text>
                <Text style={styles.successEmail}>{email}</Text>
                <View style={styles.spamWarningBox}>
                  <Text style={styles.spamWarning}>Check Spam / Junk Mail</Text>
                </View>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.switchLink}>Back to sign in</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <>
            <Text style={styles.cardTitle}>Sign up</Text>
            <Text style={styles.cardDescription}>
              A password is required as a backup sign-in method.
            </Text>

            {/* Email */}
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.concrete}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />

            {/* Password */}
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="At least 8 characters"
                placeholderTextColor={COLORS.concrete}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showPassword ? "HIDE" : "SHOW"}</Text>
              </Pressable>
            </View>

            {/* Confirm Password */}
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.concrete}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
              />
              <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showConfirm ? "HIDE" : "SHOW"}</Text>
              </Pressable>
            </View>

            {/* Error */}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Submit Button */}
            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </Pressable>

            <Text style={styles.trustSignal}>
              Your password is securely encrypted. We never share your data.
            </Text>

            {/* Sign in link */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.switchLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
            </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.safetyOrange,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.concrete,
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.gunmetal,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.concrete,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.concrete,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.asphalt,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.asphalt,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 8,
    marginBottom: 12,
  },
  inputFlex: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: COLORS.white,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.concrete,
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.critical,
    marginBottom: 8,
  },
  button: {
    backgroundColor: COLORS.safetyOrange,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
  },
  trustSignal: {
    fontSize: 12,
    color: COLORS.concrete,
    textAlign: "center",
    marginTop: 12,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  switchText: {
    fontSize: 14,
    color: COLORS.concrete,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.safetyOrange,
  },
  successContainer: {
    alignItems: "center",
  },
  successEmail: {
    fontSize: 16,
    color: COLORS.safe,
    marginTop: 12,
    marginBottom: 8,
  },
  spamWarningBox: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: COLORS.warn,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  spamWarning: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.warn,
    textAlign: "center",
    letterSpacing: 0.5,
  },
});
