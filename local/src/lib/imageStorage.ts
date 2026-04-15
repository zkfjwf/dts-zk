import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

// Fallback extension when the source uri does not expose one.
const DEFAULT_IMAGE_EXT = ".jpg";

// Cache album permission so repeated saves feel faster.
let albumPermissionGranted = false;

// Check whether the incoming uri still points to a remote image.
export function isRemoteImageUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

// Only file:// uris can be written to the system album directly.
function isDirectAlbumUri(uri: string) {
  return /^file:\/\//i.test(uri);
}

// Try to infer the file extension from the original uri.
function getFileExt(uri: string) {
  const cleanUri = uri.split("?")[0].split("#")[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]{2,8})$/);
  return match ? `.${match[1].toLowerCase()}` : DEFAULT_IMAGE_EXT;
}

// Make sure the target directory exists before writing files.
async function ensureDir(targetDir: string) {
  const dirInfo = await FileSystem.getInfoAsync(targetDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }
}

// Build a stable absolute path under the app document directory.
function getAppStoragePath(relativePath: string) {
  if (!FileSystem.documentDirectory) {
    return "";
  }
  const baseDir = FileSystem.documentDirectory.endsWith("/")
    ? FileSystem.documentDirectory
    : `${FileSystem.documentDirectory}/`;
  return `${baseDir}${relativePath.replace(/^\/+/, "")}`;
}

// Ensure the parent directory of a target file already exists.
async function ensureParentDirForFile(targetPath: string) {
  const normalized = targetPath.replace(/\\/g, "/");
  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex < 0) {
    return;
  }
  const parentDir = normalized.slice(0, lastSlashIndex);
  if (!parentDir) {
    return;
  }
  await ensureDir(parentDir);
}

// Copy or download an image into a fixed path inside the app sandbox.
export async function saveImageToAppRelativePath(
  uri: string,
  relativePath: string,
) {
  const targetPath = getAppStoragePath(relativePath);
  if (!targetPath) {
    return uri;
  }

  const normalizedSourceUri = uri.replace(/\\/g, "/");
  const normalizedTargetPath = targetPath.replace(/\\/g, "/");
  if (normalizedSourceUri === normalizedTargetPath) {
    return targetPath;
  }

  try {
    await ensureParentDirForFile(targetPath);
    const existed = await FileSystem.getInfoAsync(targetPath);
    if (existed.exists) {
      await FileSystem.deleteAsync(targetPath, { idempotent: true });
    }

    if (isRemoteImageUri(uri) && FileSystem.downloadAsync) {
      const downloaded = await FileSystem.downloadAsync(uri, targetPath);
      return downloaded.uri || targetPath;
    }

    await FileSystem.copyAsync({ from: uri, to: targetPath });
    return targetPath;
  } catch {
    return uri;
  }
}

// Copy or download the image into the app sandbox for later reuse.
export async function saveImageToLocalDir(uri: string, folderName: string) {
  if (!FileSystem.documentDirectory) {
    return uri;
  }

  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${getFileExt(uri)}`;
  return saveImageToAppRelativePath(uri, `${folderName}/${fileName}`);
}

// Handle media-library permission details in one place.
async function ensureAlbumPermission() {
  if (albumPermissionGranted) {
    return;
  }

  const currentPermission = await MediaLibrary.getPermissionsAsync();
  if (currentPermission.granted) {
    albumPermissionGranted = true;
    return;
  }

  const nextPermission = currentPermission.canAskAgain
    ? await MediaLibrary.requestPermissionsAsync()
    : currentPermission;

  if (!nextPermission.granted) {
    throw new Error("请先允许应用访问相册，然后再执行保存。");
  }

  albumPermissionGranted = true;
}

// Save the image into the system album with as little extra copying as possible.
export async function saveImageToAlbum(uri: string, folderName: string) {
  await ensureAlbumPermission();

  const localImageUri = isDirectAlbumUri(uri)
    ? uri
    : await saveImageToLocalDir(uri, folderName);
  if (!isDirectAlbumUri(localImageUri)) {
    throw new Error("图片未能成功转成本地文件，暂时无法写入系统相册。");
  }

  await MediaLibrary.saveToLibraryAsync(localImageUri);
  return localImageUri;
}
