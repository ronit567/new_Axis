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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';
import { RootStackParamList } from '../types';

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

  const handleSave = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
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
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.changePhoto}>Change photo</Text>
            </TouchableOpacity>
          </View>

          {/* Full name */}
          <Text style={styles.fieldLabel}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
          />

          {/* Program */}
          <Text style={styles.fieldLabel}>Program</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowProgramPicker(!showProgramPicker)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownText}>{program}</Text>
            <Ionicons
              name={showProgramPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
          {showProgramPicker && (
            <View style={styles.dropdownList}>
              {PROGRAMS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.dropdownItem, p === program ? styles.dropdownItemActive : null]}
                  onPress={() => {
                    setProgram(p);
                    setShowProgramPicker(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, p === program ? styles.dropdownItemTextActive : null]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Year */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Year of study</Text>
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

          {/* Bio */}
          <View style={styles.descHeader}>
            <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Bio</Text>
            <Text style={styles.charCount}>{bio.length}/{BIO_MAX}</Text>
          </View>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={t => setBio(t.slice(0, BIO_MAX))}
            placeholder="Tell buyers a bit about yourself."
            placeholderTextColor={COLORS.textMuted}
            multiline
            textAlignVertical="top"
          />

          {/* Default pickup area */}
          <Text style={styles.fieldLabel}>Default pickup area</Text>
          <TextInput
            style={styles.input}
            value={pickupArea}
            onChangeText={setPickupArea}
            placeholder="e.g. UCC, Richmond Row"
            placeholderTextColor={COLORS.textMuted}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save changes</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerBtn: {
    minWidth: 56,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  saveText: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
    width: '100%',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },

  /* avatar */
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    height: SIZES.inputHeight,
    paddingHorizontal: 14,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 16,
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
    backgroundColor: '#F3EEFF',
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
  },
  bioInput: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: SIZES.borderRadiusSm,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: SIZES.base,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    minHeight: 90,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.borderRadius,
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: SIZES.base,
    fontWeight: '600',
  },
});
