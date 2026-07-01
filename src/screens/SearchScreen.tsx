import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { COLORS } from "../constants/theme";
import { RootStackParamList, Listing } from "../types";

import ListingCard from "../components/ListingCard";
import SkeletonLoader from "../components/SkeletonLoader";
import { LISTINGS } from "../data/mockListings";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

const FILTER_CATEGORIES = ["Textbooks", "Electronics", "Furniture", "Tickets"];
const CONDITIONS = ["Like new", "Good", "Any"];

export default function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(["Textbooks"]);
  const [condition, setCondition] = useState("Like new");
  const [priceMax, setPriceMax] = useState(80);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const results = LISTINGS.filter((l) => {
    const matchQuery =
      !query || l.title.toLowerCase().includes(query.toLowerCase());
    const matchCat =
      selectedCategories.length === 0 ||
      selectedCategories.includes(l.category);
    return matchQuery && matchCat;
  });

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  const renderItem = ({ item }: { item: Listing }) => (
    <ListingCard
      item={item}
      onPress={() => navigation.navigate("ListingDetail", { listing: item })}
      onSave={() => {}}
      style={styles.card}
    />
  );

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />

      {/* Purple curved header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={17}
              color={COLORS.textMuted}
            />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search textbooks, furniture..."
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={17}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowFilters(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Results count + cancel */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {isLoading ? "Searching…" : `${results.length} results`}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Results Grid */}
      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {[0, 1].map((colIndex) => (
                <View key={colIndex} style={styles.skeletonCard}>
                  <SkeletonLoader width="100%" height={128} borderRadius={0} />
                  <View style={styles.skeletonInfo}>
                    <SkeletonLoader width="40%" height={15} />
                    <SkeletonLoader width="90%" height={12} />
                    <SkeletonLoader width="70%" height={11} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Filter Bottom Sheet */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.overlayBg}
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
          />
          <View
            style={[
              styles.filterSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategories([]);
                  setCondition("Any");
                  setPriceMax(200);
                }}
              >
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category */}
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.chipWrap}>
                {FILTER_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterChip,
                      selectedCategories.includes(cat)
                        ? styles.filterChipActive
                        : null,
                    ]}
                    onPress={() => toggleCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedCategories.includes(cat)
                          ? styles.filterChipTextActive
                          : null,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price Range */}
              <Text style={styles.filterLabel}>Price</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>$0</Text>
                <Text style={styles.priceLabel}>${priceMax}</Text>
              </View>
              <View style={styles.sliderTrack}>
                <View style={styles.sliderFill} />
                <View style={styles.sliderThumb} />
              </View>
              <View style={styles.priceAdjustRow}>
                <TouchableOpacity
                  style={styles.priceBtn}
                  onPress={() => setPriceMax((m) => Math.max(10, m - 10))}
                >
                  <Text style={styles.priceBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.priceDisplay}>${priceMax}</Text>
                <TouchableOpacity
                  style={styles.priceBtn}
                  onPress={() => setPriceMax((m) => Math.min(500, m + 10))}
                >
                  <Text style={styles.priceBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Condition */}
              <Text style={styles.filterLabel}>Condition</Text>
              <View style={styles.conditionRow}>
                {CONDITIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.conditionBtn,
                      condition === c ? styles.conditionBtnActive : null,
                    ]}
                    onPress={() => setCondition(c)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.conditionText,
                        condition === c ? styles.conditionTextActive : null,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* CTA */}
            <TouchableOpacity
              style={styles.showResultsBtn}
              onPress={() => setShowFilters(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.showResultsText}>
                Show {results.length} results
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F5F5FA",
  },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#4A2070",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
  },
  skeletonCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: "hidden",
  },
  skeletonInfo: {
    padding: 10,
    gap: 7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  filterSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    maxHeight: "80%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  resetText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E4E4E4",
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: "#E4E4E4",
    borderRadius: 2,
    marginBottom: 8,
    position: "relative",
    justifyContent: "center",
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    width: "60%",
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  sliderThumb: {
    position: "absolute",
    left: "58%",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
    marginTop: -7,
  },
  priceAdjustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  priceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  priceBtnText: {
    fontSize: 18,
    color: COLORS.text,
    lineHeight: 22,
  },
  priceDisplay: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    minWidth: 60,
    textAlign: "center",
  },
  conditionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  conditionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E4E4E4",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  conditionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  conditionText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
  },
  conditionTextActive: {
    color: COLORS.white,
    fontWeight: "600",
  },
  showResultsBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  showResultsText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
