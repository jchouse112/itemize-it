import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, Package, Briefcase, User } from "lucide-react-native";
import { formatCurrency, COLORS } from "../../lib/utils";
import { supabase, IIReceiptItem } from "../../lib/supabase";

type ClassFilter = "all" | "business" | "personal" | "unclassified";

const FILTERS: { key: ClassFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "business", label: "Business" },
  { key: "personal", label: "Personal" },
  { key: "unclassified", label: "Unclassified" },
];

function ClassificationBadge({ classification }: { classification: string }) {
  const config = {
    business: { icon: Briefcase, color: COLORS.safe, bg: "rgba(16,185,129,0.1)", label: "Business" },
    personal: { icon: User, color: "#3B82F6", bg: "rgba(59,130,246,0.1)", label: "Personal" },
    unclassified: { icon: Package, color: COLORS.safetyOrange, bg: "rgba(255,95,0,0.1)", label: "Unclassified" },
  }[classification] || { icon: Package, color: COLORS.concrete, bg: "transparent", label: classification };

  const Icon = config.icon;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Icon size={12} color={config.color} />
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

export default function ItemsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<IIReceiptItem[]>([]);
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    try {
      let query = supabase
        .from("ii_receipt_items")
        .select("*")
        .is("parent_item_id", null)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setItems(data ?? []);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const filteredItems = items.filter((item) => {
    if (filter !== "all" && item.classification !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false) ||
        (item.category?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const renderItem = ({ item }: { item: IIReceiptItem }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemMeta}>
          {item.category && (
            <Text style={styles.itemCategory}>{item.category}</Text>
          )}
          <ClassificationBadge classification={item.classification} />
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemPrice}>
          {formatCurrency(item.total_price_cents)}
        </Text>
        {item.quantity > 1 && (
          <Text style={styles.itemQty}>×{item.quantity}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Items</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.concrete} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, categories..."
            placeholderTextColor={COLORS.concrete}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                filter === f.key && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.safetyOrange} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package size={48} color={COLORS.concrete} />
          <Text style={styles.emptyTitle}>
            {search ? "No matching items" : "No items yet"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? "Try a different search term"
              : "Items will appear here after you classify receipts"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.asphalt,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.edgeSteel,
    backgroundColor: COLORS.asphalt,
  },
  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 15,
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
  },
  filterChipActive: {
    backgroundColor: COLORS.safetyOrange,
    borderColor: COLORS.safetyOrange,
  },
  filterChipText: {
    color: COLORS.concrete,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.edgeSteel,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  itemCategory: {
    color: COLORS.concrete,
    fontSize: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemPrice: {
    color: COLORS.white,
    fontFamily: "monospace",
    fontWeight: "bold",
    fontSize: 16,
  },
  itemQty: {
    color: COLORS.concrete,
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    opacity: 0.7,
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.concrete,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
