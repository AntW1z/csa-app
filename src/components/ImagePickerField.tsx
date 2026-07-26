import { useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickImage, uploadImage, ImageFolder } from '../storage';
import { colors, radius, spacing } from '../theme';

interface Props {
  folder: ImageFolder;
  value: string;
  onChange: (url: string) => void;
  // Lets the parent form disable its Save/Publish button while an upload
  // is in flight, so it can't be submitted with a stale or empty imageUrl.
  onUploadingChange?: (uploading: boolean) => void;
}

export default function ImagePickerField({ folder, value, onChange, onUploadingChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pick = async () => {
    setError('');
    const uri = await pickImage();
    if (!uri) return;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadImage(uri, folder);
      onChange(url);
    } catch (err) {
      console.warn('Image upload failed:', err);
      setError('Upload failed — check your connection and try again.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Pressable style={styles.box} onPress={pick} disabled={uploading}>
        {value ? (
          <Image source={{ uri: value }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Tap to pick an image</Text>
          </View>
        )}
        {uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.onAccent} />
          </View>
        )}
      </Pressable>
      {value && !uploading && (
        <Pressable onPress={pick} hitSlop={8}>
          <Text style={styles.changeText}>Change image</Text>
        </Pressable>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  preview: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  placeholderText: { color: colors.textMuted, fontSize: 12 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: { color: colors.red, fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
  error: { color: colors.red, fontSize: 12, marginTop: spacing.xs },
});
