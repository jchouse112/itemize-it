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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { COLORS } from "../../lib/utils";

export default function SetPasswordScreen() {
  const router = useRouter();
  const { setPassword, user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSetPassword = async () => {
    if (!newPassword) {
      setError("Please enter a password");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await setPassword(newPassword);
    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      router.replace("/(tabs)");
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
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set a backup password</Text>
            <Text style={styles.cardDescription}>
              You signed in with a magic link. A password is required as a backup
              sign-in method for your account security.
            </Text>

            {user?.email && (
              <View style={styles.emailBadge}>
                <Text style={styles.emailBadgeText}>{user.email}</Text>
              </View>
            )}

            {/* Password */}
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="At least 8 characters"
                placeholderTextColor={COLORS.concrete}
                value={newPassword}
                onChangeText={setNewPassword}
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
              onPress={handleSetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Set Password & Continue</Text>
              )}
            </Pressable>

            <Text style={styles.trustSignal}>
              Your password is securely encrypted and stored.
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
    lineHeight: 20,
  },
  emailBadge: {
    backgroundColor: COLORS.asphalt,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  emailBadgeText: {
    fontSize: 14,
    color: COLORS.safetyOrange,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.concrete,
    marginBottom: 6,
    marginTop: 4,
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
});
