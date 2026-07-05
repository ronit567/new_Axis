import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../types';
import RotatingChevron from '../components/RotatingChevron';
import PressableScale from '../components/PressableScale';
import InputField from '../components/InputField';
import PrimaryButton from '../components/PrimaryButton';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const PROGRAMS = [
  'Ivey HBA',
  'Computer Science',
  'Medical Sciences',
  'Engineering',
  'Business Administration',
  'Arts and Humanities',
  'Social Science',
  'Science',
];

const YEARS = [1, 2, 3, 4, 'Grad'];

const BIO_MAX = 150;

export default function EditProfileScreen({ navigation }: Props) {
  const [name, setName] = useState('Ronit S.');
  const [program, setProgram] = useState('Ivey HBA');
  const [year, setYear] = useState<number | string>(2);
  const [bio, setBio] = useState('2nd-year Ivey student, mostly selling textbooks & dorm stuff.');
  const [pickupArea, setPickupArea] = useState('UCC');
  const [showProgramPicker, setShowProgramPicker] = useState(false);

  const [bioFocused, setBioFocused] = useState(false);

  const handleSave = () => {
    haptics.impact();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <PressableScale
          style={styles.saveHeaderBtn}
          onPress={handleSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          scaleTo={0.92}
        >
          <Text style={styles.saveText}>Save</Text>
        </PressableScale>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>RS</Text>
              <View style={styles.cameraBtn}>
                <Ionicons name="camera" size={13} color={COLORS.white} />
              </View>
            </View>
            <PressableScale
              onPress={() => haptics.tap()}
              scaleTo={0.94}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.changePhoto}>Change photo</Text>
            </PressableScale>
          </View>

          {/* Full name */}
          <InputField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />

          {/* Program */}
          <Text style={styles.fieldLabel}>Program</Text>
          <PressableScale
            style={styles.dropdown}
            onPress={() => {
              haptics.tap();
              setShowProgramPicker(!showProgramPicker);
            }}
            scaleTo={0.98}
          >
            <Text style={styles.dropdownText}>{program}</Text>
            <RotatingChevron open={showProgramPicker} size={16} color={COLORS.textMuted} />
          </PressableScale>
          {showProgramPicker && (
            <View style={styles.dropdownList}>
              {PROGRAMS.map(p => (
                <PressableScale
                  key={p}
                  style={[styles.dropdownItem, p === program ? styles.dropdownItemActive : null]}
                  onPress={() => {
                    haptics.tap();
                    setProgram(p);
                    setShowProgramPicker(false);
                  }}
                  scaleTo={0.98}
                >
                  <Text style={[styles.dropdownItemText, p === program ? styles.dropdownItemTextActive : null]}>
                    {p}
                  </Text>
                </PressableScale>
              ))}
            </View>
          )}

          {/* Year */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Year of study</Text>
          <View style={styles.yearsRow}>
            {YEARS.map(y => (
              <PressableScale
                key={y}
                style={[styles.yearBtn, year === y ? styles.yearBtnActive : null]}
                onPress={() => {
                  haptics.tap();
                  setYear(y);
                }}
                scaleTo={0.94}
              >
                <Text style={[styles.yearBtnText, year === y ? styles.yearBtnTextActive : null]}>
                  {y}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Bio */}
          <View style={styles.descHeader}>
            <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Bio</Text>
            <Text style={styles.charCount}>{bio.length}/{BIO_MAX}</Text>
          </View>
          {/*
            InputField (shared component) doesn't support multiline, so the
            bio field reproduces its border/focus styling locally instead of
            editing the shared component.
          */}
          <View style={[styles.bioWrapper, bioFocused ? styles.bioWrapperFocused : null]}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={t => setBio(t.slice(0, BIO_MAX))}
              placeholder="Tell buyers a bit about yourself."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              onFocus={() => setBioFocused(true)}
              onBlur={() => setBioFocused(false)}
            />
          </View>

          {/* Default pickup area */}
          <InputField
            label="Default pickup area"
            value={pickupArea}
            onChangeText={setPickupArea}
            placeholder="e.g. UCC, Richmond Row"
          />

          <PrimaryButton title="Save changes" onPress={handleSave} style={styles.saveBtn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHeaderBtn: {
    minWidth: 44,
    minHeight: 38,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  saveText: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.primary,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  /* avatar */
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...SHADOWS.raised,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: SIZES.xl,
    fontWeight: '700',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    ...SHADOWS.card,
  },
  changePhoto: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },

  /* fields */
  fieldLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
    backgroundColor: COLORS.white,
  },
  dropdownText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    backgroundColor: COLORS.white,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.primaryTint,
  },
  dropdownItemText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  yearsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  yearBtn: {
    flex: 1,
    height: 40,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  yearBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearBtnText: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  yearBtnTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  descHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  charCount: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  bioWrapper: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  bioWrapperFocused: {
    borderColor: COLORS.inputBorderFocused,
    backgroundColor: COLORS.primaryTint,
  },
  bioInput: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: SIZES.base,
    color: COLORS.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 12,
  },
});
