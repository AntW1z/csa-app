import { Modal, View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { PopupConfig } from '../types';

// Deliberately reappears every time this component mounts (i.e. every app
// launch), since that's the behavior we want: closing it only dismisses it
// for the current session, not forever.
export default function PromoPopup({ popup, onClose }: { popup: PopupConfig; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <Text style={styles.closeText}>close</Text>
          </Pressable>
          <Text style={styles.title}>{popup.title}</Text>
          <Text style={styles.description}>{popup.description}</Text>
          {popup.ctaText ? (
            <Pressable
              style={styles.cta}
              onPress={() => {
                if (popup.ctaLink) Linking.openURL(popup.ctaLink);
                onClose();
              }}
            >
              <Text style={styles.ctaText}>{popup.ctaText}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  closeBtn: { alignSelf: 'flex-end' },
  closeText: { color: '#888', fontSize: 13 },
  title: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  description: { fontSize: 14, color: '#555', marginTop: 6, marginBottom: 16 },
  cta: { backgroundColor: '#A32D2D', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '600' },
});
