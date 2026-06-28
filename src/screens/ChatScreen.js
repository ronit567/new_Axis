import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

const INITIAL_MESSAGES = [
  {
    id: '1',
    text: 'Hey! Is the iPad still available?',
    sent: false,
    time: '2:14 PM',
  },
  {
    id: '2',
    text: 'Yep! Still here. Comes with the box + charger.',
    sent: true,
    time: '2:16 PM',
  },
  {
    id: '3',
    text: "Can do $270 and I'll meet at UCC 👍",
    sent: false,
    time: '2:18 PM',
    dealAmount: '$270',
  },
];

export default function ChatScreen({ navigation, route }) {
  const listing = route?.params?.listing ?? null;
  const contact = route?.params?.contact ?? {
    initials: 'AK',
    avatarColor: COLORS.primary,
    name: 'Aria K.',
  };

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const listRef = useRef(null);

  const lastMessage = messages[messages.length - 1];
  const dealAmount = messages.find(m => m.dealAmount)?.dealAmount;

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), text, sent: true, time: 'Now' },
    ]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const renderMessage = ({ item, index }) => {
    const isLast = index === messages.length - 1;
    return (
      <View>
        <View
          style={[
            styles.bubbleWrap,
            item.sent ? styles.bubbleWrapSent : styles.bubbleWrapReceived,
          ]}
        >
          <View
            style={[
              styles.bubble,
              item.sent ? styles.bubbleSent : styles.bubbleReceived,
            ]}
          >
            <Text style={[styles.bubbleText, item.sent ? styles.bubbleTextSent : null]}>
              {item.text}
            </Text>
          </View>
        </View>
        {item.dealAmount && (
          <View style={styles.dealRow}>
            <View style={styles.dealTag}>
              <Text style={styles.dealTagText}>Deal — {item.dealAmount}</Text>
            </View>
            <Text style={styles.dealStatus}>
              <Text style={styles.dealStatusPending}>Pending</Text>
            </Text>
          </View>
        )}
        {isLast && dealAmount && (
          <View style={styles.meetRow}>
            <Text style={styles.meetLabel}>Where to meet?</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: contact.avatarColor }]}>
          <Text style={styles.headerAvatarText}>{contact.initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{contact.name}</Text>
          <View style={styles.activeRow}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active now</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => listing && navigation.navigate('ListingDetail', { listing })}
        >
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>

      {/* Listing preview banner */}
      <View style={styles.listingBanner}>
        <View style={styles.listingThumb} />
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle}>iPad Air 64GB</Text>
          <Text style={styles.listingPrice}>$280</Text>
        </View>
        <TouchableOpacity
          style={styles.viewBannerBtn}
          onPress={() => listing && navigation.navigate('ListingDetail', { listing })}
        >
          <Text style={styles.viewBannerBtnText}>View</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.emojiBtn}>
            <Ionicons name="happy-outline" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, inputText.trim() ? styles.sendBtnActive : null]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={inputText.trim() ? COLORS.white : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.success,
  },
  activeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  viewBtnText: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 12,
  },
  listingThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EEE8F8',
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  listingPrice: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  viewBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  viewBannerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  bubbleWrap: {
    marginBottom: 8,
  },
  bubbleWrapSent: {
    alignItems: 'flex-end',
  },
  bubbleWrapReceived: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleSent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: '#F0F0F5',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: SIZES.base,
    color: COLORS.text,
    lineHeight: 22,
  },
  bubbleTextSent: {
    color: COLORS.white,
  },
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: -2,
    marginBottom: 10,
    gap: 8,
    paddingRight: 4,
  },
  dealTag: {
    backgroundColor: '#F5F5FA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  dealTagText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  dealStatus: {
    fontSize: 12,
  },
  dealStatusPending: {
    color: '#F5A623',
    fontWeight: '700',
  },
  meetRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  meetLabel: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 8,
    backgroundColor: COLORS.white,
  },
  emojiBtn: {
    paddingBottom: 6,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: SIZES.base,
    color: COLORS.text,
    maxHeight: 120,
    backgroundColor: COLORS.white,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnActive: {
    backgroundColor: COLORS.primary,
  },
});
