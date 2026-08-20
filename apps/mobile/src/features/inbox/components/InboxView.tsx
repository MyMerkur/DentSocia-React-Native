import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MessageCircle } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { useAuthStore } from "../../../store/useAuthStore";
import { getSocket } from "../../../services/socket";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { EmptyState } from "../../../components/EmptyState";
import {
  startThread,
  listThreads,
  listMessages,
  sendMessage,
  type ThreadCategory,
  type ThreadContextType,
  type ThreadSummary,
  type MessageItem,
} from "../../../services/inboxApi";

interface InboxViewProps {
  // Renders a "Kapat" button in the list header — InboxView is always hosted inside
  // InboxModal now (both the contextual "message this person" flows and the general
  // inbox list opened from InboxHeaderButton), so this is effectively always provided.
  onClose?: () => void;
  active?: boolean;
  startTarget?: { userId: string; context?: { type: ThreadContextType; id?: string } } | null;
}

const CATEGORY_LABELS: Record<"all" | ThreadCategory, string> = {
  all: "Tümü",
  job: "İş",
  case: "Vaka",
  general: "Genel",
};

export function InboxView({ onClose, active = true, startTarget }: InboxViewProps) {
  const { colors } = useTheme();
  const [view, setView] = useState<"list" | "thread">("list");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ThreadCategory>("all");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<ThreadSummary | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const currentUserId = useAuthStore((state) => state.user?.id);

  const loadThreads = useCallback(() => {
    setLoading(true);
    setError(null);
    listThreads()
      .then((page) => setThreads(page.threads))
      .catch((err) => setError(getApiErrorMessage(err, "Sohbetler yüklenemedi")))
      .finally(() => setLoading(false));
  }, []);

  const openThread = useCallback((thread: ThreadSummary) => {
    setActiveThread(thread);
    setView("thread");
    setLoading(true);
    setError(null);
    listMessages(thread.id)
      .then((page) => setMessages([...page.messages].reverse()))
      .catch((err) => setError(getApiErrorMessage(err, "Mesajlar yüklenemedi")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active) {
      setView("list");
      setActiveThread(null);
      setMessages([]);
      return;
    }

    if (startTarget) {
      setLoading(true);
      setError(null);
      startThread(startTarget.userId, startTarget.context)
        .then((thread) => openThread(thread))
        .catch((err) => setError(getApiErrorMessage(err, "Sohbet başlatılamadı")))
        .finally(() => setLoading(false));
      return;
    }

    loadThreads();
  }, [active, startTarget, loadThreads, openThread]);

  useEffect(() => {
    if (!active || view !== "thread" || !activeThread) {
      return;
    }

    const socket = getSocket();
    if (!socket) {
      return;
    }

    function handleNewMessage(payload: { threadId: string; message: MessageItem }) {
      if (payload.threadId !== activeThread!.id) {
        return;
      }
      setMessages((current) => [...current, payload.message]);
    }

    socket.on("message:new", handleNewMessage);
    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [active, view, activeThread]);

  async function handleSend() {
    const body = messageText.trim();
    if (!body || !activeThread || sending) {
      return;
    }
    setSending(true);
    try {
      const message = await sendMessage(activeThread.id, body);
      setMessages((current) => [...current, message]);
      setMessageText("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Mesaj gönderilemedi"));
    } finally {
      setSending(false);
    }
  }

  function handleCloseSheet() {
    setMessageText("");
    onClose?.();
  }

  function handleBack() {
    setView("list");
    setActiveThread(null);
    setMessages([]);
    loadThreads();
  }

  const filteredThreads = threads.filter((thread) => categoryFilter === "all" || thread.category === categoryFilter);

  return (
    <KeyboardAvoidingView style={styles.flexFill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        {view === "thread" ? (
          <TouchableOpacity onPress={handleBack}>
            <Text style={[styles.closeText, { color: colors.accentGold }]}>← Geri</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.title, { color: colors.textPrimary }]}>Mesajlar</Text>
        )}
        {view === "thread" ? (
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeThread?.participant.displayName}
          </Text>
        ) : null}
        {onClose ? (
          <TouchableOpacity onPress={handleCloseSheet}>
            <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {view === "list" ? (
        <>
          <View style={styles.filterRow}>
            {(["all", "job", "case", "general"] as const).map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterChip,
                  { borderColor: colors.border },
                  categoryFilter === category && { backgroundColor: colors.accentGold, borderColor: colors.accentGold },
                ]}
                onPress={() => setCategoryFilter(category)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    categoryFilter === category && { color: colors.background, fontWeight: typography.weights.semibold },
                  ]}
                >
                  {CATEGORY_LABELS[category]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={styles.loader}>
              <BrandSpinner />
            </View>
          ) : (
            <ScrollView>
              {filteredThreads.length === 0 ? (
                <EmptyState icon={MessageCircle} title="Henüz bir sohbetin yok" />
              ) : null}
              {filteredThreads.map((thread) => (
                <TouchableOpacity
                  key={thread.id}
                  style={[styles.threadRow, { borderTopColor: colors.border }]}
                  onPress={() => openThread(thread)}
                >
                  <Avatar name={thread.participant.displayName} imageUrl={thread.participant.avatarUrl} size="md" />
                  <View style={styles.threadContent}>
                    <View style={styles.threadHeader}>
                      <Text style={[styles.threadName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {thread.participant.displayName}
                      </Text>
                      <Text style={[styles.categoryTag, { color: colors.textSecondary, borderColor: colors.border }]}>
                        {CATEGORY_LABELS[thread.category]}
                      </Text>
                    </View>
                    <Text style={[styles.threadPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                      {thread.lastMessagePreview}
                    </Text>
                  </View>
                  {thread.unreadCount > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                      <Text style={styles.badgeText}>{thread.unreadCount > 9 ? "9+" : thread.unreadCount}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <View style={styles.loader}>
              <BrandSpinner />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              style={styles.messagesScroll}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    message.senderId === currentUserId ? styles.bubbleOwn : styles.bubbleOther,
                    { backgroundColor: message.senderId === currentUserId ? colors.accentBlue : colors.surfaceElevated },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: colors.textPrimary }]}>{message.body}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.composerRow}>
            <TextInput
              style={[styles.composerInput, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Bir mesaj yaz..."
              placeholderTextColor={colors.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <Button label="Gönder" onPress={handleSend} loading={sending} variant="gold" size="sm" />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  closeText: {
    fontSize: typography.sizes.sm,
  },
  loader: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  error: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: 1,
    paddingVertical: spacing.md,
  },
  threadContent: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  threadName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    flexShrink: 1,
  },
  categoryTag: {
    fontSize: 10,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  threadPreview: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  badge: {
    marginLeft: spacing.xs,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
  messagesScroll: {
    flex: 1,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  bubbleOwn: {
    alignSelf: "flex-end",
  },
  bubbleOther: {
    alignSelf: "flex-start",
  },
  bubbleText: {
    fontSize: typography.sizes.sm,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
});
