import type { ViewStyle } from "react-native";
import { ModalShell } from "../../../components/ModalShell";
import { InboxView } from "./InboxView";
import type { ThreadContextType } from "../../../services/inboxApi";

interface InboxModalProps {
  visible: boolean;
  onClose: () => void;
  startTarget?: { userId: string; context?: { type: ThreadContextType; id?: string } } | null;
}

const SHEET_HEIGHT: ViewStyle = { height: "85%" };

// Contextual "message this person" entry point (Feed, matches, applicant lists, profiles).
// Also hosts the general inbox list itself (no startTarget) via InboxHeaderButton, on
// Ana Sayfa's header — see InboxHeaderButton.
export function InboxModal({ visible, onClose, startTarget }: InboxModalProps) {
  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
      <InboxView onClose={onClose} active={visible} startTarget={startTarget} />
    </ModalShell>
  );
}
