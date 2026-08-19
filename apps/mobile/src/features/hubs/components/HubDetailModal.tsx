import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { Card } from "../../../components/Card";
import {
  getHub,
  joinFreeHub,
  leaveHub,
  listHubPosts,
  createHubPost,
  type HubItem,
  type HubPostItem,
} from "../../../services/hubApi";
import { HubMembershipCheckoutWebView } from "./HubMembershipCheckoutWebView";

interface HubDetailModalProps {
  hubId: string | null;
  onClose: () => void;
  onMembershipChanged?: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

export function HubDetailModal({ hubId, onClose, onMembershipChanged }: HubDetailModalProps) {
  const { colors } = useTheme();
  const [hub, setHub] = useState<HubItem | null>(null);
  const [posts, setPosts] = useState<HubPostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hubId) {
      return;
    }
    setCheckoutVisible(false);
    setNewPostText("");
    loadHub(hubId);
  }, [hubId]);

  async function loadHub(id: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await getHub(id);
      setHub(result);
      if (result.isMember) {
        const feed = await listHubPosts(id);
        setPosts(feed.posts);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Hub yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!hubId) {
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await joinFreeHub(hubId);
      await loadHub(hubId);
      onMembershipChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Hub'a katılınamadı"));
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave() {
    if (!hubId) {
      return;
    }
    setLeaving(true);
    setError(null);
    try {
      await leaveHub(hubId);
      await loadHub(hubId);
      onMembershipChanged?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Hub'dan ayrılınamadı"));
    } finally {
      setLeaving(false);
    }
  }

  function handleCheckoutDone(result: "success" | "cancelled") {
    setCheckoutVisible(false);
    if (result === "success" && hubId) {
      loadHub(hubId);
      onMembershipChanged?.();
    }
  }

  async function handlePost() {
    if (!hubId || newPostText.trim().length === 0) {
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const created = await createHubPost(hubId, newPostText.trim());
      setPosts((current) => [created, ...current]);
      setNewPostText("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Gönderi paylaşılamadı"));
    } finally {
      setPosting(false);
    }
  }

  return (
    <ModalShell visible={hubId !== null} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{hub?.name ?? "Hub"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {checkoutVisible && hubId ? (
            <HubMembershipCheckoutWebView hubId={hubId} onDone={handleCheckoutDone} />
          ) : loading ? (
            <View style={styles.loader}><BrandSpinner /></View>
          ) : hub ? (
            <ScrollView style={styles.content}>
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              {hub.description ? (
                <Text style={[styles.description, { color: colors.textSecondary }]}>{hub.description}</Text>
              ) : null}
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {hub.memberCount} üye · {hub.type === "paid" ? `₺${hub.price}/ay` : "Ücretsiz"}
              </Text>

              {!hub.isMember ? (
                <Button
                  label={hub.type === "free" ? "Katıl" : `Üye Ol (₺${hub.price}/ay)`}
                  onPress={hub.type === "free" ? handleJoin : () => setCheckoutVisible(true)}
                  loading={joining}
                  fullWidth
                  style={styles.actionButton}
                />
              ) : (
                <>
                  {!hub.isOwner ? (
                    <Button
                      label="Hub'dan Ayrıl"
                      onPress={handleLeave}
                      loading={leaving}
                      variant="danger"
                      fullWidth
                      style={styles.leaveButton}
                    />
                  ) : null}

                  <View style={styles.postForm}>
                    <Input
                      style={styles.multiline}
                      placeholder="Hub'da bir şeyler paylaş…"
                      value={newPostText}
                      onChangeText={setNewPostText}
                      multiline
                    />
                    <Button
                      label="Paylaş"
                      onPress={handlePost}
                      loading={posting}
                      disabled={newPostText.trim().length === 0}
                      fullWidth
                      style={styles.actionButton}
                    />
                  </View>

                  {posts.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz gönderi yok.</Text>
                  ) : (
                    posts.map((post) => (
                      <Card key={post.id} variant="elevated" style={styles.card}>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                          {post.author.displayName}
                        </Text>
                        <Text style={[styles.cardBody, { color: colors.textPrimary }]}>{post.text}</Text>
                      </Card>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
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
  content: {
    maxHeight: "100%",
  },
  error: {
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  leaveButton: {
    marginBottom: spacing.md,
  },
  postForm: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    textAlign: "center",
    marginVertical: spacing.lg,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardSubtitle: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontSize: typography.sizes.sm,
  },
});
