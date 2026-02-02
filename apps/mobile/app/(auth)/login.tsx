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

type LoginMethod = "magic-link" | "password";

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithMagicLink, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("magic-link");
  const [showNoPasswordHelp, setShowNoPasswordHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleMethodChange = (method: LoginMethod) => {
    setLoginMethod(method);
    setError(null);
    setShowNoPasswordHelp(false);
    setPassword("");
  };

  const handleMagicLinkLogin = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithMagicLink(email.trim());
    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      setSuccess(true);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }
    setLoading(true);
    setError(null);
    setShowNoPasswordHelp(false);

    const { error: authError } = await signInWithPassword(email.trim(), password);
    setLoading(false);

    if (authError) {
      if (
        authError.includes("Invalid login credentials") ||
        authError.includes("invalid_credentials")
      ) {
        setError("Invalid email or password.");
        setShowNoPasswordHelp(true);
      } else {
        setError(authError);
      }
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleLogin = () => {
    if (loginMethod === "password") {
      handlePasswordLogin();
    } else {
      handleMagicLinkLogin();
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
              Classify business expenses in seconds.
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {success ? (
              <View style={styles.successContainer}>
                <Text style={styles.cardTitle}>Check your email</Text>
                <Text style={styles.cardDescription}>
                  We sent you a magic link. Click it to sign in.
                </Text>
                <Text style={styles.successEmail}>{email}</Text>
                <View style={styles.spamWarningBox}>
                  <Text style={styles.spamWarning}>Check Spam / Junk Mail</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSuccess(false);
                    setEmail("");
                  }}
                >
                  <Text style={styles.linkText}>Try a different email</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardTitle}>Sign in</Text>
                <Text style={styles.cardDescription}>
                  Choose your preferred sign-in method
                </Text>

                {/* Method Tabs */}
                <View style={styles.methodTabs}>
                  <Pressable
                    onPress={() => handleMethodChange("magic-link")}
                    style={[
                      styles.methodTab,
                      loginMethod === "magic-link" && styles.methodTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodTabText,
                        loginMethod === "magic-link" && styles.methodTabTextActive,
                      ]}
                    >
                      Magic Link
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleMethodChange("password")}
                    style={[
                      styles.methodTab,
                      loginMethod === "password" && styles.methodTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodTabText,
                        loginMethod === "password" && styles.methodTabTextActive,
                      ]}
                    >
                      Password
                    </Text>
                  </Pressable>
                </View>

                {/* Email Input */}
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

                {/* Password Input */}
                {loginMethod === "password" && (
                  <>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.inputFlex}
                        placeholder="Enter your password"
                        placeholderTextColor={COLORS.concrete}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="password"
                      />
                      <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                        <Text style={styles.eyeText}>{showPassword ? "HIDE" : "SHOW"}</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {/* Error */}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* No-password help */}
                {showNoPasswordHelp && loginMethod === "password" && (
                  <View style={styles.helpBox}>
                    <Text style={styles.helpText}>
                      Signed up with a magic link? You can:
                    </Text>
                    <TouchableOpacity onPress={() => handleMethodChange("magic-link")}>
                      <Text style={styles.helpLink}>
                        Use magic link to sign in
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Submit Button */}
                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {loginMethod === "password"
                        ? "Sign In"
                        : "Email me a sign-in link"}
                    </Text>
                  )}
                </Pressable>

                {/* Trust signal */}
                <Text style={styles.trustSignal}>
                  {loginMethod === "password"
                    ? "Your password is securely encrypted."
                    : "We only email you for sign-in. Your data stays private."}
                </Text>

                {/* Sign up link */}
                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
                    <Text style={styles.switchLink}>Sign up</Text>
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
  methodTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.edgeSteel,
    borderRadius: 8,
    padding: 3,
    marginBottom: 20,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  methodTabActive: {
    backgroundColor: COLORS.asphalt,
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.concrete,
  },
  methodTabTextActive: {
    color: COLORS.white,
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
  helpBox: {
    backgroundColor: COLORS.asphalt,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    color: COLORS.concrete,
    marginBottom: 6,
  },
  helpLink: {
    fontSize: 13,
    color: COLORS.safetyOrange,
    marginTop: 2,
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
  linkText: {
    fontSize: 14,
    color: COLORS.safetyOrange,
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
});
