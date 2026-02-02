import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import { Download, Calendar, Filter, FileText, CheckCircle2 } from "lucide-react-native";
import { COLORS } from "../lib/utils";
import { useExport, ExportConfig } from "../hooks/useExport";

// Quick date presets
function getPresetDates(preset: string): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case "this_month":
      return {
        from: new Date(year, month, 1).toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      };
    case "last_month":
      return {
        from: new Date(year, month - 1, 1).toISOString().slice(0, 10),
        to: new Date(year, month, 0).toISOString().slice(0, 10),
      };
    case "this_quarter": {
      const qStart = Math.floor(month / 3) * 3;
      return {
        from: new Date(year, qStart, 1).toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      };
    }
    case "ytd":
      return {
        from: new Date(year, 0, 1).toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      };
    default:
      return { from: "", to: "" };
  }
}

const DATE_PRESETS = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "ytd", label: "Year to Date" },
];

const CLASSIFICATIONS = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "personal", label: "Personal" },
] as const;

export function ExportConfigurator() {
  const { config, updateConfig, generate, isGenerating, error } = useExport();
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePreset = (key: string) => {
    setActivePreset(key);
    const dates = getPresetDates(key);
    updateConfig({ from: dates.from, to: dates.to });
  };

  const handleGenerate = async () => {
    setSuccess(false);
    const ok = await generate();
    if (ok) setSuccess(true);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Date Range */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Calendar size={16} color={COLORS.concrete} />
          <Text style={styles.sectionTitle}>Date Range</Text>
        </View>
        <View style={styles.presetsRow}>
          {DATE_PRESETS.map((preset) => (
            <Pressable
              key={preset.key}
              onPress={() => handlePreset(preset.key)}
              style={[
                styles.presetChip,
                activePreset === preset.key && styles.presetChipActive,
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  activePreset === preset.key && styles.presetChipTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {config.from && config.to && (
          <Text style={styles.dateRange}>
            {config.from} — {config.to}
          </Text>
        )}
      </View>

      {/* Classification Filter */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Filter size={16} color={COLORS.concrete} />
          <Text style={styles.sectionTitle}>Classification</Text>
        </View>
        <View style={styles.presetsRow}>
          {CLASSIFICATIONS.map((cls) => (
            <Pressable
              key={cls.key}
              onPress={() => updateConfig({ classification: cls.key as ExportConfig["classification"] })}
              style={[
                styles.presetChip,
                config.classification === cls.key && styles.presetChipActive,
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  config.classification === cls.key && styles.presetChipTextActive,
                ]}
              >
                {cls.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Format */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={16} color={COLORS.concrete} />
          <Text style={styles.sectionTitle}>Format</Text>
        </View>
        <View style={styles.presetsRow}>
          <Pressable
            onPress={() => updateConfig({ format: "csv" })}
            style={[
              styles.presetChip,
              config.format === "csv" && styles.presetChipActive,
            ]}
          >
            <Text
              style={[
                styles.presetChipText,
                config.format === "csv" && styles.presetChipTextActive,
              ]}
            >
              CSV
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateConfig({ format: "pdf" })}
            style={[
              styles.presetChip,
              config.format === "pdf" && styles.presetChipActive,
              styles.presetChipDisabled,
            ]}
            disabled
          >
            <Text style={[styles.presetChipText, { opacity: 0.4 }]}>
              PDF (Coming Soon)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Success */}
      {success && (
        <View style={styles.successBanner}>
          <CheckCircle2 size={16} color={COLORS.safe} />
          <Text style={styles.successText}>Export generated successfully</Text>
        </View>
      )}

      {/* Generate Button */}
      <Pressable
        onPress={handleGenerate}
        disabled={isGenerating}
        style={({ pressed }) => [
          styles.generateButton,
          pressed && styles.generateButtonPressed,
          isGenerating && styles.generateButtonDisabled,
        ]}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <>
            <Download size={20} color={COLORS.white} />
            <Text style={styles.generateButtonText}>Generate Export</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.concrete,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
  },
  presetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  presetChipActive: {
    backgroundColor: COLORS.safetyOrange,
    borderColor: COLORS.safetyOrange,
  },
  presetChipDisabled: {
    opacity: 0.5,
  },
  presetChipText: {
    color: COLORS.concrete,
    fontSize: 14,
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: COLORS.white,
  },
  dateRange: {
    color: COLORS.concrete,
    fontSize: 13,
    marginTop: 10,
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: COLORS.safe,
    fontSize: 13,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.safetyOrange,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  generateButtonPressed: {
    opacity: 0.8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "bold",
  },
});
