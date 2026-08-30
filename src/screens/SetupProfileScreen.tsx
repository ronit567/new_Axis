import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Screen from '../components/layout/Screen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import StepHeader from '../components/StepHeader';
import RotatingChevron from '../components/RotatingChevron';
import PressableScale from '../components/PressableScale';
import Avatar from '../components/Avatar';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useUpsertProfile } from '../hooks/useProfile';
import { LocalPhoto } from '../repositories/StorageRepository';
import { deriveInitials } from '../repositories/mappers';
import { haptics } from '../lib/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'SetupProfile'>;

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

function initialFullName(fullName: unknown): string {
  return typeof fullName === 'string' ? fullName : '';
}

export default function SetupProfileScreen(_props: Props) {
  const { user } = useAuth();
  const upsertProfile = useUpsertProfile();
  const [name, setName] = useState(() => initialFullName(user?.user_metadata?.full_name));
  const [program, setProgram] = useState('Ivey HBA');
  const [year, setYear] = useState<number | string>(2);
  const [aboutYou, setAboutYou] = useState('');
  const [showProgramPicker, setShowProgramPicker] = useState(false);
  // Previewed immediately, uploaded on Finish (inside useUpsertProfile) — same
  // deferred-upload shape as EditProfile, so nothing is stored for a user who
  // abandons onboarding.
  const [pickedPhoto, setPickedPhoto] = useState<LocalPhoto | null>(null);

  const canFinish = name.trim().length > 0 && !upsertProfile.isPending;

  const handlePickPhoto = async () => {
    haptics.tap();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPickedPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? null });
    }
  };

  // This screen is a mandatory gate — RootNavigator only mounts it when a
  // signed-in user has no `profiles` row yet, so there's nothing to go back
  // to and no manual navigation on success: the upsert's cache update flips
  // useCurrentProfile from null, and RootNavigator swaps to the main app.
  //
  // `verified` isn't set here — a DB trigger (migration 0004) recomputes it
  // server-side from the user's real email, so a modified client can't claim
  // a trust badge it hasn't earned by just sending `verified: true`.
  const handleFinish = async () => {
    if (!canFinish) return;
    haptics.impact();
    try {
      await upsertProfile.mutateAsync({
        name: name.trim(),
        program,
        // 'Grad' has no numeric year; store null rather than fabricate one.
        year: typeof year === 'number' ? year : null,
        bio: aboutYou.trim(),
        photo: pickedPhoto,
      });
    } catch (e) {
      Alert.alert(
        'Could not save profile',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  return (
    <Screen background="surface">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* No onBack: this is a mandatory gate reached after auth, so there's
              nothing to return to — but the step indicator is kept so the flow
              still reads as "Step 3 of 3" like CreateAccount/VerifyEmail. */}
          <StepHeader currentStep={3} totalSteps={3} />

          <Text style={styles.stepLabel}>Step 3 of 3</Text>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            A real name and photo build trust with buyers and sellers.
          </Text>

          <View style={styles.profileRow}>
            <PressableScale
              style={styles.avatarWrap}
              onPress={handlePickPhoto}
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityLabel="Add a profile photo"
            >
              <Avatar
                url={pickedPhoto?.uri}
                initials={deriveInitials(name) || '?'}
                color={COLORS.primary}
                size={64}
                textStyle={styles.avatarInitials}
              />
              {/* Outside the Avatar so its overflow:hidden circle can't clip it. */}
              <View style={styles.cameraBtn}>
                <Ionicons name="camera" size={12} color={COLORS.text} />
              </View>
            </PressableScale>
            <PressableScale
              onPress={handlePickPhoto}
              scaleTo={0.94}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Add a profile photo"
            >
              <Text style={styles.addPhoto}>
                {pickedPhoto ? 'Change photo' : 'Add a photo'}
              </Text>
            </PressableScale>
          </View>

          <InputField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Ronit Sharma"
            autoCapitalize="words"
          />

          <Text style={styles.sectionLabel}>Program</Text>
          <PressableScale
            style={styles.dropdownBtn}
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
                  style={[styles.dropdownItem, p === program ? styles.dropdownItemSelected : null]}
                  onPress={() => {
                    haptics.tap();
                    setProgram(p);
                    setShowProgramPicker(false);
                  }}
                  scaleTo={0.98}
                >
                  <Text style={[styles.dropdownItemText, p === program ? styles.dropdownItemTextSelected : null]}>
                    {p}
                  </Text>
                </PressableScale>
              ))}
            </View>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Year of study</Text>
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

          <View style={styles.descHeader}>
            <Text style={[styles.sectionLabel, styles.sectionLabelInRow]}>
              About you <Text style={styles.optional}>(optional)</Text>
            </Text>
            <Text style={styles.charCount}>{aboutYou.length}/{BIO_MAX}</Text>
          </View>
          <TextInput
            style={styles.aboutInput}
            value={aboutYou}
            onChangeText={t => setAboutYou(t.slice(0, BIO_MAX))}
            placeholder="2nd-year Ivey student, mostly selling textbooks & dorm stuff."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <PrimaryButton
            title="Finish & explore"
            onPress={handleFinish}
            disabled={!canFinish}
            loading={upsertProfile.isPending}
            style={styles.finishBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  stepLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 6,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarInitials: {
    color: COLORS.white,
    fontSize: SIZES.lg,
    fontWeight: '700',
  },
  addPhoto: {
    fontSize: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
  },
  sectionLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  optional: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  // The row owns the section's spacing rather than each child carrying its
  // own copy: 16 above to match the gap the other section labels get, and 8
  // below so "About you" sits the same distance from its input as Program and
  // Year do. That 8 used to be missing entirely — the label's own marginBottom
  // has to be zeroed inside the row (see sectionLabelInRow) or alignItems
  // centers its *margin* box and knocks the text out of line with the counter,
  // which left the label flush against the input.
  descHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabelInRow: {
    marginBottom: 0,
  },
  charCount: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    backgroundColor: COLORS.white,
    marginTop: 4,
    overflow: 'hidden',
    zIndex: 10,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemSelected: {
    backgroundColor: COLORS.primaryTint,
  },
  dropdownItemText: {
    fontSize: SIZES.base,
    color: COLORS.text,
  },
  dropdownItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  yearsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  yearBtn: {
    flex: 1,
    height: 40,
    borderRadius: SIZES.borderRadiusSm,
    borderCurve: 'continuous',
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
  aboutInput: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 90,
    marginBottom: 28,
  },
  finishBtn: {},
});
