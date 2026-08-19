import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export type ImageFolder = 'posts' | 'sponsors' | 'carousel';

// Opens the photo library and returns the picked image's local URI, or
// null if the user cancelled or denied permission.
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  // allowsEditing is deliberately off — on iOS specifically, expo-image-picker's
  // native crop tool only ever offers a square crop regardless of the
  // `aspect` passed to it (a known platform limitation, not something
  // configurable away), which silently cropped non-square flyers/photos.
  // Android and web don't have this issue, which is why it only ever
  // showed up on iPhone. The app already avoids cropping images elsewhere
  // (the carousel's blurred-backdrop design, full-image display in post
  // details), so skipping the crop step entirely — same as web already
  // did — is more consistent than fighting iOS's picker for a non-square
  // ratio it doesn't actually support.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

// Resizes to a sane max width and compresses before upload. This is the
// single biggest lever on Storage's download-bandwidth free tier, since
// one image gets viewed by every user browsing the app, repeatedly — see
// the cost breakdown in the project's memory/README for why this matters
// more than the upload itself.
async function prepareForUpload(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1080 }).renderAsync();
  const result = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return result.uri;
}

// Uploads an already-picked local image under images/{folder}/ and returns
// its public download URL — this is the same string that already gets
// stored as Post/Sponsor/CarouselItem.imageUrl, so nothing downstream
// needs to change to support it.
export async function uploadImage(localUri: string, folder: ImageFolder): Promise<string> {
  const preparedUri = await prepareForUpload(localUri);
  const response = await fetch(preparedUri);
  const blob = await response.blob();
  const path = `images/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
