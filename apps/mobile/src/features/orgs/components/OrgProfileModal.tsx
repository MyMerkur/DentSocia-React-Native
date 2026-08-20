import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { radii, spacing, typography, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Avatar } from "../../../components/Avatar";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { Card } from "../../../components/Card";
import {
  getOrgProfile,
  rateOrg,
  getOrgReviews,
  listAnnouncements,
  createAnnouncement,
  listVotes,
  createVote,
  castBallot,
  closeVote,
  getDuesPlan,
  createDuesPlan,
  cancelDuesSubscription,
  getMyDuesStatus,
  listDuesSubscribers,
  type OrgProfile,
  type OrgReview,
  type OrgAnnouncement,
  type OrgVote,
  type OrgDuesPlan,
  type OrgDuesSubscriber,
  type OrgDuesPaymentInterval,
  type MyDuesStatus,
} from "../../../services/orgApi";
import { useAuthStore } from "../../../store/useAuthStore";
import { InboxModal } from "../../inbox/components/InboxModal";
import { OrgDuesCheckoutWebView } from "./OrgDuesCheckoutWebView";

interface OrgProfileModalProps {
  visible: boolean;
  orgUserId: string | null;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

function getVerifiedBadgeColor(isVerified: boolean, colors: ThemeColors): string {
  return isVerified ? colors.success : colors.textSecondary;
}

export function OrgProfileModal({ visible, orgUserId, onClose }: OrgProfileModalProps) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [reviews, setReviews] = useState<OrgReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingSaving, setRatingSaving] = useState(false);
  const currentUser = useAuthStore((state) => state.user);
  const canRate = orgUserId !== currentUser?.id && currentUser ? !(EMPLOYER_ROLES as readonly string[]).includes(currentUser.role) : false;
  const isOwnProfile = orgUserId !== null && orgUserId === currentUser?.id;

  const [announcements, setAnnouncements] = useState<OrgAnnouncement[]>([]);
  const [votes, setVotes] = useState<OrgVote[]>([]);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementBody, setNewAnnouncementBody] = useState("");
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [newVoteQuestion, setNewVoteQuestion] = useState("");
  const [newVoteOptions, setNewVoteOptions] = useState(["", ""]);
  const [creatingVote, setCreatingVote] = useState(false);
  const [castingVoteId, setCastingVoteId] = useState<string | null>(null);
  const [closingVoteId, setClosingVoteId] = useState<string | null>(null);

  const [duesPlan, setDuesPlan] = useState<OrgDuesPlan | null>(null);
  const [duesSubscribers, setDuesSubscribers] = useState<OrgDuesSubscriber[]>([]);
  const [myDuesStatus, setMyDuesStatus] = useState<MyDuesStatus | null>(null);
  const [newDuesName, setNewDuesName] = useState("");
  const [newDuesPrice, setNewDuesPrice] = useState("");
  const [newDuesInterval, setNewDuesInterval] = useState<OrgDuesPaymentInterval>("MONTHLY");
  const [creatingDuesPlan, setCreatingDuesPlan] = useState(false);
  const [duesCheckoutVisible, setDuesCheckoutVisible] = useState(false);
  const [cancelingDues, setCancelingDues] = useState(false);

  useEffect(() => {
    if (!visible || !orgUserId) {
      return;
    }
    setLoading(true);
    setError(null);
    setProfile(null);
    setSelectedRating(0);
    setAnnouncements([]);
    setVotes([]);
    setCommunityError(null);
    getOrgProfile(orgUserId)
      .then(setProfile)
      .catch((err) => setError(getApiErrorMessage(err, "Kurum profili yüklenemedi")))
      .finally(() => setLoading(false));
    getOrgReviews(orgUserId)
      .then(setReviews)
      .catch(() => undefined);
  }, [visible, orgUserId]);

  useEffect(() => {
    if (!orgUserId || profile?.role !== "dernek") {
      return;
    }
    loadCommunity(orgUserId);
    loadDues(orgUserId, isOwnProfile);
  }, [orgUserId, profile?.role, isOwnProfile]);

  function loadCommunity(orgId: string) {
    setCommunityError(null);
    Promise.all([listAnnouncements(orgId), listVotes(orgId)])
      .then(([announcementResult, voteResult]) => {
        setAnnouncements(announcementResult);
        setVotes(voteResult);
      })
      .catch(() => {
        // Üye/sahip olmayan kullanıcılar için backend 403 döner — bölümü sessizce boş bırak.
      });
  }

  async function handleCreateAnnouncement() {
    if (!orgUserId) {
      return;
    }
    setCreatingAnnouncement(true);
    setCommunityError(null);
    try {
      await createAnnouncement(orgUserId, { title: newAnnouncementTitle, body: newAnnouncementBody });
      setNewAnnouncementTitle("");
      setNewAnnouncementBody("");
      loadCommunity(orgUserId);
    } catch (err) {
      setCommunityError(getApiErrorMessage(err, "Duyuru paylaşılamadı"));
    } finally {
      setCreatingAnnouncement(false);
    }
  }

  async function handleCreateVote() {
    if (!orgUserId) {
      return;
    }
    const options = newVoteOptions.map((option) => option.trim()).filter((option) => option.length > 0);
    setCreatingVote(true);
    setCommunityError(null);
    try {
      await createVote(orgUserId, { question: newVoteQuestion, options });
      setNewVoteQuestion("");
      setNewVoteOptions(["", ""]);
      loadCommunity(orgUserId);
    } catch (err) {
      setCommunityError(getApiErrorMessage(err, "Oylama açılamadı"));
    } finally {
      setCreatingVote(false);
    }
  }

  async function handleCastBallot(voteId: string, optionIndex: number) {
    if (!orgUserId) {
      return;
    }
    setCastingVoteId(voteId);
    setCommunityError(null);
    try {
      await castBallot(voteId, optionIndex);
      loadCommunity(orgUserId);
    } catch (err) {
      setCommunityError(getApiErrorMessage(err, "Oy kullanılamadı"));
    } finally {
      setCastingVoteId(null);
    }
  }

  async function handleCloseVote(voteId: string) {
    if (!orgUserId) {
      return;
    }
    setClosingVoteId(voteId);
    setCommunityError(null);
    try {
      await closeVote(voteId);
      loadCommunity(orgUserId);
    } catch (err) {
      setCommunityError(getApiErrorMessage(err, "Oylama kapatılamadı"));
    } finally {
      setClosingVoteId(null);
    }
  }

  function loadDues(orgId: string, isOwner: boolean) {
    getDuesPlan(orgId)
      .then(setDuesPlan)
      .catch(() => undefined);
    if (isOwner) {
      listDuesSubscribers(orgId)
        .then(setDuesSubscribers)
        .catch(() => undefined);
    } else {
      getMyDuesStatus(orgId)
        .then(setMyDuesStatus)
        .catch(() => undefined);
    }
  }

  async function handleCreateDuesPlan() {
    if (!orgUserId) {
      return;
    }
    setCreatingDuesPlan(true);
    setCommunityError(null);
    try {
      await createDuesPlan(orgUserId, { name: newDuesName || undefined, price: newDuesPrice, paymentInterval: newDuesInterval });
      setNewDuesName("");
      setNewDuesPrice("");
      loadDues(orgUserId, isOwnProfile);
    } catch (err) {
      setCommunityError(getApiErrorMessage(err, "Aidat planı oluşturulamadı"));
    } finally {
      setCreatingDuesPlan(false);
    }
  }

  async function handleCancelDues() {
    if (!orgUserId) {
      return;
    }
    setCancelingDues(true);
    setCommunityError(null);
    try {
      await cancelDuesSubscription(orgUserId);
      loadDues(orgUserId, isOwnProfile);
    } catch (err) {
      setCommunityError(getApiErrorMessage(err, "Aidat üyeliği iptal edilemedi"));
    } finally {
      setCancelingDues(false);
    }
  }

  function handleDuesCheckoutDone(result: "success" | "cancelled") {
    setDuesCheckoutVisible(false);
    if (result === "success" && orgUserId) {
      loadDues(orgUserId, isOwnProfile);
    }
  }

  async function handleRate(rating: number) {
    if (!orgUserId) {
      return;
    }
    setSelectedRating(rating);
    setRatingSaving(true);
    setError(null);
    try {
      await rateOrg(orgUserId, rating);
      const [updatedProfile, updatedReviews] = await Promise.all([getOrgProfile(orgUserId), getOrgReviews(orgUserId)]);
      setProfile(updatedProfile);
      setReviews(updatedReviews);
    } catch (err) {
      setError(getApiErrorMessage(err, "Değerlendirme kaydedilemedi"));
    } finally {
      setRatingSaving(false);
    }
  }

  const monthlyIntervalActive = newDuesInterval === "MONTHLY";
  const yearlyIntervalActive = newDuesInterval === "YEARLY";
  const monthlyButtonStyle = monthlyIntervalActive
    ? { borderColor: colors.accentGold, backgroundColor: colors.surfaceElevated }
    : { borderColor: colors.border };
  const yearlyButtonStyle = yearlyIntervalActive
    ? { borderColor: colors.accentGold, backgroundColor: colors.surfaceElevated }
    : { borderColor: colors.border };
  const monthlyTextColor = monthlyIntervalActive ? colors.accentGold : colors.textSecondary;
  const yearlyTextColor = yearlyIntervalActive ? colors.accentGold : colors.textSecondary;

  return (
    <>
      <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Kurum Vitrini</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {loading ? <View style={styles.loader}><BrandSpinner /></View> : null}
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          {duesCheckoutVisible && orgUserId ? (
            <OrgDuesCheckoutWebView orgId={orgUserId} onDone={handleDuesCheckoutDone} />
          ) : profile ? (
            <ScrollView>
              <View style={styles.profileHeader}>
                <Avatar name={profile.displayName} imageUrl={profile.avatarUrl} size="lg" />
                <View style={styles.profileHeaderText}>
                  <Text style={[styles.displayName, { color: colors.textPrimary }]}>{profile.displayName}</Text>
                  {profile.workplace ? (
                    <Text style={[styles.workplace, { color: colors.textSecondary }]}>{profile.workplace}</Text>
                  ) : null}
                  <Text
                    style={[styles.verifiedBadge, { color: getVerifiedBadgeColor(profile.isVerifiedOrg, colors) }]}
                  >
                    {profile.isVerifiedOrg ? "✅ Doğrulanmış Kurum" : "⚠️ Doğrulanmamış Kurum"}
                  </Text>
                  <Text style={[styles.ratingSummary, { color: colors.textSecondary }]}>
                    {profile.rating.count > 0
                      ? `⭐ ${profile.rating.average} (${profile.rating.count} değerlendirme)`
                      : "Henüz değerlendirme yok"}
                  </Text>
                  {profile.postHireVerificationStats.yesCount + profile.postHireVerificationStats.noCount > 0 ? (
                    <Text style={[styles.ratingSummary, { color: colors.textSecondary }]}>
                      Güven Göstergesi: %
                      {Math.round(
                        (profile.postHireVerificationStats.yesCount /
                          (profile.postHireVerificationStats.yesCount + profile.postHireVerificationStats.noCount)) *
                          100,
                      )}{" "}
                      şart uyumu (
                      {profile.postHireVerificationStats.yesCount + profile.postHireVerificationStats.noCount} yanıt)
                    </Text>
                  ) : null}
                </View>
              </View>

              {profile.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text> : null}

              {profile.id !== currentUser?.id ? (
                <Button
                  label="Mesaj Gönder"
                  onPress={() => setMessageVisible(true)}
                  variant="gold"
                  size="sm"
                  style={styles.messageButton}
                />
              ) : null}

              {canRate ? (
                <View style={styles.rateSection}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Değerlendir</Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <TouchableOpacity key={value} onPress={() => handleRate(value)} disabled={ratingSaving}>
                        <Text style={[styles.star, { color: colors.accentGold }]}>
                          {value <= selectedRating ? "★" : "☆"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Değerlendirmeler ({reviews.length})
              </Text>
              {reviews.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz değerlendirme yok</Text>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={[styles.reviewRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.reviewAuthor, { color: colors.textPrimary }]}>
                      {review.author.displayName} — {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </Text>
                    {review.comment ? (
                      <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{review.comment}</Text>
                    ) : null}
                  </View>
                ))
              )}

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ekip ({profile.team.length})</Text>
              {profile.team.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz ekip üyesi eklenmemiş</Text>
              ) : (
                profile.team.map((member) => (
                  <View key={member.id} style={styles.teamRow}>
                    <Avatar name={member.displayName} imageUrl={member.avatarUrl} size="sm" />
                    <Text style={[styles.teamName, { color: colors.textPrimary }]}>{member.displayName}</Text>
                  </View>
                ))
              )}

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Açık İlanlar ({profile.openJobs.length})
              </Text>
              {profile.openJobs.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Açık ilan yok</Text>
              ) : (
                profile.openJobs.map((job) => (
                  <View key={job.id} style={styles.jobRow}>
                    <Text style={[styles.jobTitle, { color: colors.textPrimary }]}>{job.title}</Text>
                    {job.location ? (
                      <Text style={[styles.jobLocation, { color: colors.textSecondary }]}>{job.location}</Text>
                    ) : null}
                  </View>
                ))
              )}

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Vakalar ({profile.recentCases.length})
              </Text>
              {profile.recentCases.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz paylaşılan vaka yok</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.caseRow}>
                  {profile.recentCases.map((item) => (
                    <View key={item.id} style={styles.caseCard}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.caseImage} />
                      ) : (
                        <View style={[styles.caseImage, { backgroundColor: colors.surfaceElevated }]} />
                      )}
                      <Text style={[styles.caseTitle, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {profile.role === "dernek" ? (
                <>
                  {communityError ? (
                    <Text style={[styles.error, { color: colors.danger }]}>{communityError}</Text>
                  ) : null}

                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Duyurular ({announcements.length})
                  </Text>
                  {isOwnProfile ? (
                    <View style={styles.communityForm}>
                      <Input
                        style={styles.field}
                        placeholder="Duyuru başlığı"
                        value={newAnnouncementTitle}
                        onChangeText={setNewAnnouncementTitle}
                      />
                      <Input
                        style={[styles.field, styles.multiline]}
                        placeholder="Duyuru içeriği"
                        value={newAnnouncementBody}
                        onChangeText={setNewAnnouncementBody}
                        multiline
                      />
                      <Button
                        label="Duyuru Paylaş"
                        onPress={handleCreateAnnouncement}
                        loading={creatingAnnouncement}
                        disabled={newAnnouncementTitle.trim().length === 0 || newAnnouncementBody.trim().length === 0}
                        fullWidth
                        style={styles.field}
                      />
                    </View>
                  ) : null}
                  {announcements.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz duyuru yok</Text>
                  ) : (
                    announcements.map((announcement) => (
                      <View key={announcement.id} style={[styles.reviewRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.reviewAuthor, { color: colors.textPrimary }]}>{announcement.title}</Text>
                        <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>{announcement.body}</Text>
                      </View>
                    ))
                  )}

                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Oylamalar ({votes.length})</Text>
                  {isOwnProfile ? (
                    <View style={styles.communityForm}>
                      <Input
                        style={styles.field}
                        placeholder="Oylama sorusu"
                        value={newVoteQuestion}
                        onChangeText={setNewVoteQuestion}
                      />
                      {newVoteOptions.map((option, index) => (
                        <Input
                          key={index}
                          style={styles.field}
                          placeholder={`Seçenek ${index + 1}`}
                          value={option}
                          onChangeText={(value) =>
                            setNewVoteOptions((current) => current.map((item, i) => (i === index ? value : item)))
                          }
                        />
                      ))}
                      <TouchableOpacity onPress={() => setNewVoteOptions((current) => [...current, ""])}>
                        <Text style={[styles.backLink, { color: colors.accentGold }]}>+ Seçenek Ekle</Text>
                      </TouchableOpacity>
                      <Button
                        label="Oylama Aç"
                        onPress={handleCreateVote}
                        loading={creatingVote}
                        disabled={newVoteQuestion.trim().length === 0}
                        fullWidth
                        style={styles.field}
                      />
                    </View>
                  ) : null}
                  {votes.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz oylama yok</Text>
                  ) : (
                    votes.map((vote) => (
                      <Card key={vote.id} variant="elevated" style={styles.card}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{vote.question}</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                          {vote.status === "open" ? "Açık" : "Kapalı"}
                        </Text>
                        {vote.results.map((result, index) => (
                          <View key={index} style={styles.voteOptionRow}>
                            <Text style={[styles.voteOptionText, { color: colors.textPrimary }]}>
                              {result.option} — {result.count} oy{vote.myOptionIndex === index ? " (Sizin oyunuz)" : ""}
                            </Text>
                            {vote.status === "open" && vote.myOptionIndex === null ? (
                              <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: colors.accentGold }]}
                                onPress={() => handleCastBallot(vote.id, index)}
                                disabled={castingVoteId === vote.id}
                              >
                                <Text style={[styles.secondaryButtonText, { color: colors.accentGold }]}>Oy Ver</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ))}
                        {isOwnProfile && vote.status === "open" ? (
                          <Button
                            label="Oylamayı Kapat"
                            onPress={() => handleCloseVote(vote.id)}
                            loading={closingVoteId === vote.id}
                            variant="danger"
                            fullWidth
                            style={styles.field}
                          />
                        ) : null}
                      </Card>
                    ))
                  )}

                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Aidat</Text>
                  {isOwnProfile ? (
                    !duesPlan ? (
                      <View style={styles.communityForm}>
                        <Input
                          style={styles.field}
                          placeholder="Plan adı (opsiyonel)"
                          value={newDuesName}
                          onChangeText={setNewDuesName}
                        />
                        <Input
                          style={styles.field}
                          placeholder="Tutar (₺)"
                          keyboardType="decimal-pad"
                          value={newDuesPrice}
                          onChangeText={setNewDuesPrice}
                        />
                        <View style={styles.typeRow}>
                          <TouchableOpacity
                            style={[styles.typeButton, monthlyButtonStyle]}
                            onPress={() => setNewDuesInterval("MONTHLY")}
                          >
                            <Text style={[styles.typeText, monthlyIntervalActive && styles.typeTextActive, { color: monthlyTextColor }]}>
                              Aylık
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.typeButton, yearlyButtonStyle]}
                            onPress={() => setNewDuesInterval("YEARLY")}
                          >
                            <Text style={[styles.typeText, yearlyIntervalActive && styles.typeTextActive, { color: yearlyTextColor }]}>
                              Yıllık
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Button
                          label="Aidat Planı Oluştur"
                          onPress={handleCreateDuesPlan}
                          loading={creatingDuesPlan}
                          disabled={newDuesPrice.trim().length === 0}
                          fullWidth
                        />
                      </View>
                    ) : (
                      <View>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          {duesPlan.name} — ₺{duesPlan.price} / {duesPlan.paymentInterval === "MONTHLY" ? "ay" : "yıl"}
                        </Text>
                        {duesSubscribers.length === 0 ? (
                          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz aidat abonesi yok</Text>
                        ) : (
                          duesSubscribers.map((subscriber) => (
                            <View key={subscriber.id} style={[styles.reviewRow, { borderTopColor: colors.border }]}>
                              <Text style={[styles.reviewAuthor, { color: colors.textPrimary }]}>
                                {subscriber.member.displayName}
                              </Text>
                              <Text style={[styles.reviewComment, { color: colors.textSecondary }]}>
                                {subscriber.status}
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )
                  ) : !duesPlan ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bu derneğin henüz aidat planı yok</Text>
                  ) : (
                    <View>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {duesPlan.name} — ₺{duesPlan.price} / {duesPlan.paymentInterval === "MONTHLY" ? "ay" : "yıl"}
                      </Text>
                      {myDuesStatus?.status === "active" ? (
                        <Button
                          label="Aidat Üyeliğini İptal Et"
                          onPress={handleCancelDues}
                          loading={cancelingDues}
                          variant="danger"
                          fullWidth
                        />
                      ) : (
                        <Button label="Aidat Öde" onPress={() => setDuesCheckoutVisible(true)} fullWidth />
                      )}
                    </View>
                  )}
                </>
              ) : null}
            </ScrollView>
          ) : null}
      </ModalShell>

      <InboxModal
        visible={messageVisible}
        onClose={() => setMessageVisible(false)}
        startTarget={profile ? { userId: profile.id, context: { type: "org", id: profile.id } } : null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  profileHeaderText: {
    flex: 1,
  },
  displayName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  workplace: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  verifiedBadge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  ratingSummary: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  rateSection: {
    marginBottom: spacing.sm,
  },
  starRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  star: {
    fontSize: typography.sizes.xl,
  },
  reviewRow: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  reviewAuthor: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  reviewComment: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  bio: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  messageButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  teamName: {
    fontSize: typography.sizes.sm,
  },
  jobRow: {
    paddingVertical: spacing.xs,
  },
  jobTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  jobLocation: {
    fontSize: typography.sizes.xs,
  },
  caseRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  caseCard: {
    width: 100,
  },
  caseImage: {
    width: 100,
    height: 75,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  caseTitle: {
    fontSize: typography.sizes.xs,
  },
  communityForm: {
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  backLink: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  voteOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  voteOptionText: {
    fontSize: typography.sizes.sm,
    flexShrink: 1,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  secondaryButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  typeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  typeTextActive: {
    fontWeight: typography.weights.semibold,
  },
});
