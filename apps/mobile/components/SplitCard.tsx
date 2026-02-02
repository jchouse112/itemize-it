import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { Briefcase, User, Percent, DollarSign, Scissors } from "lucide-react-native";
import { formatCurrency, COLORS } from "../lib/utils";

type SplitMode = "percentage" | "fixed";

interface SplitPortion {
  amountCents: number;
  classification: "business" | "personal";
  percentage: number;
}

interface SplitCardProps {
  itemName: string;
  totalCents: number;
  onSplit: (splits: { amountCents: number; classification: "business" | "personal" }[]) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function SplitCard({ itemName, totalCents, onSplit, onCancel, isSaving }: SplitCardProps) {
  const [mode, setMode] = useState<SplitMode>("percentage");
  const [businessPercent, setBusinessPercent] = useState(50);
  const [businessFixedStr, setBusinessFixedStr] = useState(
    (totalCents / 200).toFixed(2) // Default 50%
  );

  // Compute split amounts
  const splits = useMemo((): SplitPortion[] => {
    let businessCents: number;
    let personalCents: number;

    if (mode === "percentage") {
      businessCents = Math.round((totalCents * businessPercent) / 100);
      personalCents = totalCents - businessCents;
    } else {
      businessCents = Math.round(parseFloat(businessFixedStr || "0") * 100);
      if (isNaN(businessCents) || businessCents < 0) businessCents = 0;
      if (businessCents > totalCents) businessCents = totalCents;
      personalCents = totalCents - businessCents;
    }

    return [
      { amountCents: businessCents, classification: "business", percentage: Math.round((businessCents / totalCents) * 100) },
      { amountCents: personalCents, classification: "personal", percentage: Math.round((personalCents / totalCents) * 100) },
    ];
  }, [mode, businessPercent, businessFixedStr, totalCents]);

  const isValid = splits[0].amountCents > 0 && splits[1].amountCents > 0;

  const handleQuickSplit = useCallback((percent: number) => {
    setMode("percentage");
    setBusinessPercent(percent);
    setBusinessFixedStr(((totalCents * percent) / 10000).toFixed(2));
  }, [totalCents]);

  const handlePercentChange = useCallback((text: string) => {
    const val = parseInt(text, 10);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      setBusinessPercent(val);
      setBusinessFixedStr(((totalCents * val) / 10000).toFixed(2));
    }
  }, [totalCents]);

  const handleFixedChange = useCallback((text: string) => {
    setBusinessFixedStr(text);
    const cents = Math.round(parseFloat(text || "0") * 100);
    if (!isNaN(cents) && cents >= 0 && cents <= totalCents) {
      setBusinessPercent(Math.round((cents / totalCents) * 100));
    }
  }, [totalCents]);

  const handleConfirm = () => {
    if (!isValid || isSaving) return;
    onSplit(
      splits
        .filter((s) => s.amountCents > 0)
        .map(({ amountCents, classification }) => ({ amountCents, classification }))
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Scissors size={18} color={COLORS.safetyOrange} />
        <Text style={styles.headerText}>Split Item</Text>
      </View>

      {/* Item info */}
      <Text style={styles.itemName} numberOfLines={2}>{itemName}</Text>
      <Text style={styles.itemTotal}>{formatCurrency(totalCents)}</Text>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <Pressable
          onPress={() => setMode("percentage")}
          style={[styles.modeButton, mode === "percentage" && styles.modeButtonActive]}
        >
          <Percent size={14} color={mode === "percentage" ? COLORS.white : COLORS.concrete} />
          <Text style={[styles.modeButtonText, mode === "percentage" && styles.modeButtonTextActive]}>
            Percentage
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("fixed")}
          style={[styles.modeButton, mode === "fixed" && styles.modeButtonActive]}
        >
          <DollarSign size={14} color={mode === "fixed" ? COLORS.white : COLORS.concrete} />
          <Text style={[styles.modeButtonText, mode === "fixed" && styles.modeButtonTextActive]}>
            Fixed Amount
          </Text>
        </Pressable>
      </View>

      {/* Quick Split Buttons */}
      <View style={styles.quickSplits}>
        {[25, 50, 75].map((pct) => (
          <Pressable
            key={pct}
            onPress={() => handleQuickSplit(pct)}
            style={[
              styles.quickButton,
              businessPercent === pct && mode === "percentage" && styles.quickButtonActive,
            ]}
          >
            <Text
              style={[
                styles.quickButtonText,
                businessPercent === pct && mode === "percentage" && styles.quickButtonTextActive,
              ]}
            >
              {pct}/{100 - pct}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Input */}
      <View style={styles.inputSection}>
        {mode === "percentage" ? (
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Business %</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={String(businessPercent)}
                onChangeText={handlePercentChange}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <Text style={styles.inputSuffix}>%</Text>
            </View>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Business $</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                style={styles.input}
                value={businessFixedStr}
                onChangeText={handleFixedChange}
                keyboardType="decimal-pad"
                maxLength={10}
                selectTextOnFocus
              />
            </View>
          </View>
        )}
      </View>

      {/* Preview */}
      <View style={styles.preview}>
        <View style={styles.previewRow}>
          <View style={styles.previewLeft}>
            <Briefcase size={16} color={COLORS.safe} />
            <Text style={styles.previewLabel}>Business</Text>
          </View>
          <Text style={styles.previewAmount}>
            {formatCurrency(splits[0].amountCents)} ({splits[0].percentage}%)
          </Text>
        </View>

        {/* Visual bar */}
        <View style={styles.barContainer}>
          <View
            style={[
              styles.barBusiness,
              { flex: splits[0].amountCents || 1 },
            ]}
          />
          <View
            style={[
              styles.barPersonal,
              { flex: splits[1].amountCents || 1 },
            ]}
          />
        </View>

        <View style={styles.previewRow}>
          <View style={styles.previewLeft}>
            <User size={16} color={COLORS.concrete} />
            <Text style={styles.previewLabel}>Personal</Text>
          </View>
          <Text style={styles.previewAmount}>
            {formatCurrency(splits[1].amountCents)} ({splits[1].percentage}%)
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleConfirm}
          disabled={!isValid || isSaving}
          style={[
            styles.confirmButton,
            (!isValid || isSaving) && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.confirmButtonText}>
            {isSaving ? "Splitting..." : "Split Item"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 2,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  headerText: {
    color: COLORS.safetyOrange,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  itemName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  itemTotal: {
    color: COLORS.concrete,
    fontSize: 16,
    fontFamily: "monospace",
    marginBottom: 16,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: COLORS.asphalt,
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: COLORS.edgeSteel,
  },
  modeButtonText: {
    color: COLORS.concrete,
    fontSize: 13,
    fontWeight: "500",
  },
  modeButtonTextActive: {
    color: COLORS.white,
  },
  quickSplits: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
  },
  quickButtonActive: {
    borderColor: COLORS.safetyOrange,
    backgroundColor: "rgba(255, 95, 0, 0.1)",
  },
  quickButtonText: {
    color: COLORS.concrete,
    fontSize: 13,
    fontWeight: "600",
  },
  quickButtonTextActive: {
    color: COLORS.safetyOrange,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputLabel: {
    color: COLORS.concrete,
    fontSize: 14,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.asphalt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    paddingHorizontal: 12,
  },
  input: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "monospace",
    paddingVertical: 8,
    minWidth: 80,
    textAlign: "right",
  },
  inputPrefix: {
    color: COLORS.concrete,
    fontSize: 16,
    marginRight: 2,
  },
  inputSuffix: {
    color: COLORS.concrete,
    fontSize: 16,
    marginLeft: 2,
  },
  preview: {
    backgroundColor: COLORS.asphalt,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewLabel: {
    color: COLORS.concrete,
    fontSize: 14,
  },
  previewAmount: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  barContainer: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 10,
    gap: 2,
  },
  barBusiness: {
    backgroundColor: COLORS.safe,
    borderRadius: 3,
  },
  barPersonal: {
    backgroundColor: COLORS.edgeSteel,
    borderRadius: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    alignItems: "center",
  },
  cancelButtonText: {
    color: COLORS.concrete,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.safetyOrange,
    alignItems: "center",
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
