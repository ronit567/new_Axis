import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SIZES, GRADIENTS, FONTS, SHADOWS } from '../constants/theme';
import { Message, RootStackParamList } from '../types';
import ReportModal from '../components/ReportModal';
import PressableScale from '../components/PressableScale';
import ActivitySpinner from '../components/ActivitySpinner';
import ErrorState from '../components/ErrorState';
import { haptics } from '../lib/haptics';
import { useAuth } from '../context/AuthContext';
import { useMessages, useSendMessage, useMarkConversationRead } from '../hooks/useMessages';
import { formatClockTime } from '../lib/timeAgo';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { listingId, partnerId, partner, listingTitle, listingPrice } = route.params;
  const { user } = useAuth();

  const { data, isPending, isError, refetch } = useMessages(listingId, partnerId);
  const messages = data ?? [];
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  // Newest unread id we've already requested a receipt for. Re-arms whenever a
  // newer unread message lands (e.g. via realtime while the thread is open),
  // so receipts keep flowing for the whole time the user is looking at the
  // thread — not just on first open.
  const lastMarkedUnreadId = useRef<string | null>(null);

  const [inputText, setInputText] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const unread = messages.filter(m => m.receiverId === user?.id && m.readAt === null);
    if (unread.length === 0) return;
    const newestUnreadId = unread[unread.length - 1].id;
    if (lastMarkedUnreadId.current === newestUnreadId) return;
    lastMarkedUnreadId.current = newestUnreadId;
    markRead.mutate({ listingId, partnerId });
  }, [messages, user?.id, listingId, partnerId, markRead]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    haptics.tap();
    setInputText('');
    sendMessage.mutate(
      { listingId, receiverId: partnerId, body: text },
      {
        onError: () => {
          // Put the failed message back (unless they've already typed more)
          // so it isn't lost with the rolled-back bubble.
          setInputText(current => (current.length > 0 ? current : text));
          Alert.alert('Message not sent', 'Please try again.');
        },
      },
    );
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // Only offered when the thread has a listing we can still show (title
  // present means the row is visible under RLS) — ListingDetail loads by id.
  const canViewListing = listingId !== null && listingTitle != null;
  const handleViewListing = () => {
    if (listingId === null) return;
    haptics.tap();
    navigation.navigate('ListingDetail', { listingId });
  };

  // Read receipt, iMessage-style: only under the newest of my sent messages
  // the partner has opened. Realtime UPDATEs flip readAt in the cache, so this
  // moves live while the thread is open.
  let lastReadSentId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.senderId === user?.id && m.readAt !== null) {
      lastReadSentId = m.id;
      break;
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const sent = item.senderId === user?.id;
    return (
      <View style={[styles.bubbleWrap, sent ? styles.bubbleWrapSent : styles.bubbleWrapReceived]}>
        {sent ? (
          <LinearGradient
            colors={GRADIENTS.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleSent]}
          >
            <Text style={[styles.bubbleText, styles.bubbleTextSent]}>{item.body}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleReceived]}>
            <Text style={styles.bubbleText}>{item.body}</Text>
          </View>
        )}
        <Text style={styles.timestamp}>
          {formatClockTime(item.createdAt)}
          {item.id === lastReadSentId ? ' · Read' : ''}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          scaleTo={0.9}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </PressableScale>
        <View style={[styles.headerAvatar, { backgroundColor: partner.avatarColor }]}>
          <Text style={styles.headerAvatarText}>{partner.initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{partner.name}</Text>
        </View>
        {canViewListing && (
          <PressableScale
            style={styles.viewBtn}
            onPress={handleViewListing}
            scaleTo={0.94}
            accessibilityLabel="View listing"
          >
            <Text style={styles.viewBtnText}>View</Text>
          </PressableScale>
        )}
        <PressableScale
          style={styles.flagBtn}
          onPress={() => setReportVisible(true)}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          scaleTo={0.9}
          accessibilityLabel="Report conversation"
          accessibilityRole="button"
        >
          <Ionicons name="flag-outline" size={20} color={COLORS.textMuted} />
        </PressableScale>
      </View>

      {/* Listing preview banner */}
      {listingTitle != null && (
        <View style={styles.listingBanner}>
          <View style={styles.listingThumb} />
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle}>{listingTitle}</Text>
            {listingPrice != null && <Text style={styles.listingPrice}>${listingPrice}</Text>}
          </View>
          {canViewListing && (
            <PressableScale style={styles.viewBannerBtn} onPress={handleViewListing} scaleTo={0.94}>
              <Text style={styles.viewBannerBtnText}>View</Text>
            </PressableScale>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {isPending ? (
          <View style={styles.centerFill}>
            <ActivitySpinner />
          </View>
        ) : isError ? (
          <ErrorState message="Couldn't load messages." onRetry={() => refetch()} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <PressableScale style={styles.emojiBtn} scaleTo={0.9} accessibilityLabel="Add emoji">
            <Ionicons name="happy-outline" size={24} color={COLORS.textMuted} />
          </PressableScale>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <PressableScale
            style={[styles.sendBtn, inputText.trim() ? styles.sendBtnActive : null]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            scaleTo={0.9}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            accessibilityState={{ disabled: !inputText.trim() }}
          >
            <Ionicons
              name="arrow-up"
              size={19}
              color={inputText.trim() ? COLORS.white : COLORS.textMuted}
            />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
      <ReportModal
        visible={reportVisible}
        target="chat"
        targetName={partner.name}
        onClose={() => setReportVisible(false)}
        onBlock={() => {}}
      />
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
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
    fontFamily: FONTS.bold,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: SIZES.borderRadiusSm,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
  },
  flagBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: SIZES.borderRadiusSm,
    backgroundColor: COLORS.primarySoft,
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
    fontVariant: ['tabular-nums'],
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
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: COLORS.surfaceAlt,
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
  timestamp: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    marginHorizontal: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.brand,
  },
});
