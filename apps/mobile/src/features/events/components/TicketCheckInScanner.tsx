import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { checkInTicket, type CheckInResult } from "../../../services/eventApi";

interface TicketCheckInScannerProps {
  onClose: () => void;
}

// QR content is a verification URL once PUBLIC_APP_BASE_URL is set (post-VPS), or a bare code
// today — extract the trailing path segment either way so check-in keeps working after that change.
function extractVerificationCode(scannedValue: string): string {
  try {
    const url = new URL(scannedValue);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? scannedValue;
  } catch {
    return scannedValue;
  }
}

export function TicketCheckInScanner({ onClose }: TicketCheckInScannerProps) {
  const { colors } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastCodeRef = useRef<string | null>(null);

  const handleScan = useCallback(async (code: string) => {
    if (lastCodeRef.current === code) {
      return;
    }
    lastCodeRef.current = code;
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const response = await checkInTicket(extractVerificationCode(code));
      setResult(response);
    } catch (err) {
      setError(getApiErrorMessage(err, "Bilet doğrulanamadı"));
    } finally {
      setProcessing(false);
    }
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      if (value) {
        handleScan(value);
      }
    },
  });

  function handleScanNext() {
    lastCodeRef.current = null;
    setResult(null);
    setError(null);
  }

  if (!hasPermission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>
          Check-in için kamera izni gerekiyor.
        </Text>
        <Button label="İzin Ver" onPress={requestPermission} style={styles.actionButton} />
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Kapat</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.textPrimary }]}>Kamera bulunamadı.</Text>
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Kapat</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const resultTextColor = result?.alreadyCheckedIn ? colors.danger : colors.accentGold;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.cameraContainer}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!result && !processing}
          codeScanner={codeScanner}
        />
        {processing ? (
          <View style={styles.overlay}>
            <BrandSpinner />
          </View>
        ) : null}
      </View>

      <View style={[styles.resultPanel, { backgroundColor: colors.surface }]}>
        {result ? (
          <View>
            <Text
              style={[
                result.alreadyCheckedIn ? styles.warningText : styles.successText,
                { color: resultTextColor },
              ]}
            >
              {result.alreadyCheckedIn ? "Bu bilet zaten check-in yapılmış" : "Check-in başarılı"}
            </Text>
            <Text style={[styles.attendeeText, { color: colors.textPrimary }]}>{result.attendeeName}</Text>
            <Text style={[styles.eventText, { color: colors.textSecondary }]}>{result.eventTitle}</Text>
            <Button label="Sıradaki Bileti Okut" onPress={handleScanNext} style={styles.actionButton} />
          </View>
        ) : error ? (
          <View>
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            <Button label="Tekrar Dene" onPress={handleScanNext} style={styles.actionButton} />
          </View>
        ) : (
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>Bilet QR kodunu kameraya gösterin</Text>
        )}
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  permissionText: {
    fontSize: typography.sizes.md,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  resultPanel: {
    padding: spacing.lg,
  },
  hintText: {
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },
  successText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  warningText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  attendeeText: {
    fontSize: typography.sizes.md,
    marginTop: spacing.xs,
  },
  eventText: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  error: {
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },
  actionButton: {
    marginTop: spacing.md,
  },
  cancelLink: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  cancelLinkText: {
    fontSize: typography.sizes.sm,
  },
});
