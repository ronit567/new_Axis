import React, { useState, useRef } from "react";
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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { COLORS, GRADIENTS, SHADOWS, FONTS, SIZES } from "../constants/theme";
import { RootStackParamList, Listing, ListingCondition } from "../types";
import { useSearchListings } from "../hooks/useListings";
import { SEARCH_RESULT_LIMIT } from "../repositories/ListingRepository";

import ListingCard from "../components/ListingCard";
import ListingCardSkeleton from "../components/ListingCardSkeleton";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import PressableScale from "../components/PressableScale";
import { haptics } from "../lib/haptics";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

const FILTER_CATEGORIES = ["Textbooks", "Electronics", "Furniture", "Tickets"];
const CONDITIONS = ["Like new", "Good", "Fair", "Any"];
// The price slider's upper bound doubles as "no cap" — nothing is listed
// above it, so treating it as a sentinel keeps the filter omitted rather
// than passing a max that happens to include everything anyway.
const PRICE_MAX_CAP = 500;

export default function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // Screen opens with no filters applied so it shows every active listing
  // until the user narrows things down.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [condition, setCondition] = useState("Any");
  const [priceMax, setPriceMax] = useState(PRICE_MAX_CAP);
  const inputRef = useRef<TextInput>(null);

  const {
    data: results = [],
    isLoading,
    isError,
    refetch,
  } = useSearchListings(query, {
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    priceMax: priceMax < PRICE_MAX_CAP ? priceMax : undefined,
    condition: condition === "Any" ? undefined : (condition as ListingCondition),
  });

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  // The backend caps a single search response at SEARCH_RESULT_LIMIT, so
  // hitting that cap doesn't mean there are exactly that many matches — there
  // may be more that just aren't fetched. Say "50+" rather than implying an
  // exact count we don't actually have.
  const resultsCountLabel =
    results.length === SEARCH_RESULT_LIMIT ? `${SEARCH_RESULT_LIMIT}+` : `${results.length}`;

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
      <LinearGradient
        colors={GRADIENTS.primaryRadiant}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
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
          <PressableScale
            style={styles.filterBtn}
            onPress={() => {
              haptics.tap();
              setShowFilters(true);
            }}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel="Filters"
          >
            <Ionicons name="options-outline" size={20} color={COLORS.white} />
          </PressableScale>
        </View>
      </LinearGradient>

      {/* Results count + cancel */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {isLoading ? "Searching…" : `${resultsCountLabel} results`}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Results Grid: loading skeleton / error / list */}
      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          message="Something went wrong. Please try again."
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No results found. Try a different search."
              ctaLabel="Clear search"
              onCta={() => setQuery('')}
            />
          }
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
          >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          </TouchableOpacity>
          <View
            style={[
              styles.filterSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.grabber} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  setSelectedCategories([]);
                  setCondition("Any");
                  setPriceMax(PRICE_MAX_CAP);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category */}
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.chipWrap}>
                {FILTER_CATEGORIES.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <PressableScale
                      key={cat}
                      style={[
                        styles.filterChip,
                        selected ? styles.filterChipActive : null,
                      ]}
                      onPress={() => {
                        haptics.tap();
                        toggleCategory(cat);
                      }}
                      scaleTo={0.94}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selected ? styles.filterChipTextActive : null,
                        ]}
                      >
                        {cat}
                      </Text>
                    </PressableScale>
                  );
                })}
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
                <PressableScale
                  style={styles.priceBtn}
                  onPress={() => {
                    haptics.tap();
                    setPriceMax((m) => Math.max(10, m - 10));
                  }}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease maximum price"
                >
                  <Text style={styles.priceBtnText}>−</Text>
                </PressableScale>
                <Text style={styles.priceDisplay}>${priceMax}</Text>
                <PressableScale
                  style={styles.priceBtn}
                  onPress={() => {
                    haptics.tap();
                    setPriceMax((m) => Math.min(PRICE_MAX_CAP, m + 10));
                  }}
                  scaleTo={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Increase maximum price"
                >
                  <Text style={styles.priceBtnText}>+</Text>
                </PressableScale>
              </View>

              {/* Condition */}
              <Text style={styles.filterLabel}>Condition</Text>
              <View style={styles.conditionRow}>
                {CONDITIONS.map((c) => {
                  const selected = condition === c;
                  return (
                    <PressableScale
                      key={c}
                      style={[
                        styles.conditionBtn,
                        selected ? styles.conditionBtnActive : null,
                      ]}
                      onPress={() => {
                        haptics.tap();
                        setCondition(c);
                      }}
                      scaleTo={0.96}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.conditionText,
                          selected ? styles.conditionTextActive : null,
                        ]}
                      >
                        {c}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>

            {/* CTA */}
            <PressableScale
              style={styles.showResultsBtn}
              onPress={() => {
                haptics.impact();
                setShowFilters(false);
              }}
              scaleTo={0.97}
              accessibilityRole="button"
            >
              <Text style={styles.showResultsText}>
                Show {resultsCountLabel} results
              </Text>
            </PressableScale>
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 18,
    ...SHADOWS.floating,
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
    backgroundColor: COLORS.primaryDark,
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
    fontSize: 15,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    fontVariant: ["tabular-nums"],
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  filterSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SIZES.borderRadiusXl,
    borderTopRightRadius: SIZES.borderRadiusXl,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: "80%",
    ...SHADOWS.floating,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.inputBorder,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  resetText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: FONTS.semibold,
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
    borderRadius: SIZES.borderRadiusLg,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
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
    fontVariant: ["tabular-nums"],
  },
  sliderTrack: {
    height: 4,
    backgroundColor: COLORS.inputBorder,
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
    fontVariant: ["tabular-nums"],
  },
  conditionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  conditionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
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
    borderRadius: SIZES.borderRadius,
    height: SIZES.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    ...SHADOWS.brand,
  },
  showResultsText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONTS.semibold,
  },
});
