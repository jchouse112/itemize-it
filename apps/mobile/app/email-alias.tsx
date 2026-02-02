/**
 * Email Alias screen (PRD §5C + §7.10)
 * Generate, copy, and regenerate the business's forwarding email alias.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import {
  ChevronLeft,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Info,
} from "lucide-react-native";
import { COLORS } from "../lib/utils";
import {
  supabase,
  getForwardingEmail,
  generateForwardingEmail,
  regenerateForwardingEmail,
  getInboundEmailCount,
} from "../lib/supabase";

export default function EmailAliasScreen() {
  const insets = useSafeAreaInsets();
  const [forwardingEmail, setForwardingEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inboundCount, setInboundCount] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [needsName, setNeedsName] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const email = await getForwardingEmail();
      setForwardingEmail(email);

      if (email) {
        const count = await getInboundEmailCount();
        setInboundCount(count);
      }

      // Get user info for name
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.user_metadata?.first_name) {
        setFirstName(user.user_metadata.first_name);
        setLastName(user.user_metadata.last_name || "");
      } else if (!email) {
        setNeedsName(true);
      }
    } catch (error) {
      console.error("Error loading email alias data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!firstName.trim()) {
      Alert.alert("Name Required", "Please enter your first name to generate an alias.");
      return;
    }

    setGenerating(true);
    try {
      const email = await generateForwardingEmail(
        firstName.trim(),
        lastName.trim() || undefined
      );
      if (email) {
        setForwardingEmail(email);
        setNeedsName(false);
      } else {
        Alert.alert("Error", "Failed to generate email alias. Please try again.");
      }
    } catch (error) {
      console.error("Generate error:", error);
      Alert.alert("Error", "Failed to generate email alias.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!forwardingEmail) return;
    try {
      await Clipboard.setStringAsync(forwardingEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Error", "Failed to copy to clipboard.");
    }
  };

  const handleRegenerate = () => {
    Alert.alert(
      "Regenerate Email",
      "This will create a new email address. The old address will stop working immediately. Any pending forwarded emails may be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: async () => {
            setRegenerating(true);
            try {
              const email = await regenerateForwardingEmail(
                firstName.trim(),
                lastName.trim() || undefined
              );
              if (email) {
                setForwardingEmail(email);
              } else {
                Alert.alert("Error", "Failed to regenerate email alias.");
              }
            } catch (error) {
              console.error("Regenerate error:", error);
              Alert.alert("Error", "Failed to regenerate email alias.");
            } finally {
              setRegenerating(false);
            }
          },
        },
      ]
    );
  };

  // Preview initials
  const previewInitials =
    (firstName ? firstName.charAt(0).toUpperCase() : "?") +
    (lastName ? lastName.charAt(0).toUpperCase() : "");

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={COLORS.white} />
          </Pressable>
          <Text style={styles.headerTitle}>Email Alias</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.safetyOrange} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Email Alias</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Mail size={32} color={COLORS.safetyOrange} />
        </View>

        {forwardingEmail ? (
          <>
            {/* Current email display */}
            <Text style={styles.sectionTitle}>Your Forwarding Email</Text>

            <View style={styles.emailCard}>
              <Text style={styles.emailText}>{forwardingEmail}</Text>
            </View>

            {/* Copy button */}
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.primaryButton,
                copied && styles.copiedButton,
                pressed && styles.buttonPressed,
              ]}
            >
              {copied ? (
                <Check size={20} color={COLORS.white} />
              ) : (
                <Copy size={20} color={COLORS.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {copied ? "Copied!" : "Copy Email Address"}
              </Text>
            </Pressable>

            {/* Stats */}
            {inboundCount > 0 && (
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>{inboundCount}</Text>
                <Text style={styles.statsLabel}>
                  receipt{inboundCount !== 1 ? "s" : ""} received via email
                </Text>
              </View>
            )}

            {/* How it works */}
            <View style={styles.infoCard}>
              <Info size={16} color={COLORS.concrete} />
              <Text style={styles.infoText}>
                Forward receipts from your inbox to this address. They'll be
                automatically scanned, itemized, and ready for classification.
              </Text>
            </View>

            {/* Regenerate */}
            <Pressable
              onPress={handleRegenerate}
              disabled={regenerating}
              style={({ pressed }) => [
                styles.regenerateButton,
                pressed && styles.buttonPressed,
              ]}
            >
              {regenerating ? (
                <ActivityIndicator size="small" color={COLORS.concrete} />
              ) : (
                <RefreshCw size={16} color={COLORS.concrete} />
              )}
              <Text style={styles.regenerateText}>
                {regenerating ? "Regenerating..." : "Regenerate Email"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Setup flow */}
            <Text style={styles.sectionTitle}>Set Up Email Forwarding</Text>
            <Text style={styles.sectionSubtitle}>
              Get a unique email address to forward receipts to. We'll
              automatically scan and itemize them.
            </Text>

            {/* Name inputs (if needed) */}
            {needsName && (
              <View style={styles.nameInputs}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Enter first name"
                    placeholderTextColor={COLORS.edgeSteel}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Enter last name"
                    placeholderTextColor={COLORS.edgeSteel}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            {/* Preview */}
            <View style={styles.previewCard}>
              <Mail size={18} color={COLORS.concrete} />
              <Text style={styles.previewText}>
                Preview: {previewInitials}1@2itm.com
              </Text>
            </View>

            {/* Generate button */}
            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                generating && styles.buttonDisabled,
              ]}
            >
              {generating ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Mail size={20} color={COLORS.white} />
              )}
              <Text style={styles.primaryButtonText}>
                {generating ? "Generating..." : "Generate My Email"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 32,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: COLORS.concrete,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  emailCard: {
    width: "100%",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  emailText: {
    color: COLORS.safetyOrange,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
  primaryButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.safetyOrange,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  copiedButton: {
    backgroundColor: "#16A34A",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  statsCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsNumber: {
    color: COLORS.safetyOrange,
    fontSize: 20,
    fontWeight: "700",
  },
  statsLabel: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  infoCard: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    color: COLORS.concrete,
    fontSize: 13,
    lineHeight: 19,
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  regenerateText: {
    color: COLORS.concrete,
    fontSize: 14,
    fontWeight: "500",
  },
  nameInputs: {
    width: "100%",
    gap: 12,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: COLORS.concrete,
    fontSize: 13,
    fontWeight: "500",
  },
  textInput: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 16,
  },
  previewCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  previewText: {
    color: COLORS.concrete,
    fontSize: 14,
    fontFamily: "monospace",
  },
});
