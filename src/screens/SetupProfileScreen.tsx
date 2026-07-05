import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, SIZES } from '../constants/theme';
import PrimaryButton from '../components/PrimaryButton';
import InputField from '../components/InputField';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useUpsertProfile } from '../hooks/useProfile';
import { deriveInitials } from '../repositories/mappers';

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

  const canFinish = name.trim().length > 0 && !upsertProfile.isPending;

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
    try {
      await upsertProfile.mutateAsync({
        name: name.trim(),
        program,
        // 'Grad' has no numeric year; store null rather than fabricate one.
        year: typeof year === 'number' ? year : null,
        bio: aboutYou.trim(),
      });
    } catch (e) {
      Alert.alert(
        'Could not save profile',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>
            A real name and photo build trust with buyers and sellers.
          </Text>

          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{deriveInitials(name) || '?'}</Text>
              <View style={styles.cameraBtn}>
                <Text style={styles.cameraIcon}>📷</Text>
              </View>
            </View>
          </View>

          <InputField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Ronit Sharma"
            autoCapitalize="words"
          />

          <Text style={styles.sectionLabel}>Program</Text>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setShowProgramPicker(!showProgramPicker)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownText}>{program}</Text>
            <Text style={styles.dropdownChevron}>{showProgramPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showProgramPicker && (
            <View style={styles.dropdownList}>
              {PROGRAMS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.dropdownItem, p === program ? styles.dropdownItemSelected : null]}
                  onPress={() => {
                    setProgram(p);
                    setShowProgramPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, p === program ? styles.dropdownItemTextSelected : null]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Year of study</Text>
          <View style={styles.yearsRow}>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.yearBtn, year === y ? styles.yearBtnActive : null]}
                onPress={() => setYear(y)}
                activeOpacity={0.8}
              >
                <Text style={[styles.yearBtnText, year === y ? styles.yearBtnTextActive : null]}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
            About you <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.aboutInput}
            value={aboutYou}
            onChangeText={setAboutYou}
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
    </SafeAreaView>
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
  title: {
    fontSize: SIZES.xxl,
    fontWeight: '700',
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
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarInitials: {
    color: COLORS.white,
    fontSize: SIZES.lg,
    fontWeight: '700',
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
  cameraIcon: {
    fontSize: 11,
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
  dropdownBtn: {
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
  dropdownChevron: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  dropdownList: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
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
    backgroundColor: '#F3EEFF',
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
