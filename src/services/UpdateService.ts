import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import appConfig from '../../app.json';
import { UpdateConfig } from '../constants/UpdateConfig';

export interface ReleaseInfo {
  version: string; // semantic version without a leading "v"
  tagName: string; // raw git tag, e.g. "v1.2.3"
  notes: string; // release notes (markdown text)
  apkUrl: string | null; // direct APK download URL, when an asset is attached
  pageUrl: string; // GitHub release web page
  publishedAt: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latest: ReleaseInfo | null;
}

export type DownloadProgressCallback = (fraction: number) => void;

/** Version baked into this build, read from app.json at bundle time. */
export const CURRENT_VERSION: string = appConfig.expo.version;

const APK_MIME = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => parseInt(part, 10))
    .filter((n) => !Number.isNaN(n));
}

/** Returns > 0 when a is newer than b, < 0 when older, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Fetch the latest published GitHub release for the app repository. */
export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  const res = await fetch(UpdateConfig.RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null; // repository has no releases yet
  if (!res.ok) {
    throw new Error(`GitHub returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const tagName = typeof data?.tag_name === 'string' ? data.tag_name : '';
  const assets: unknown[] = Array.isArray(data?.assets) ? data.assets : [];
  const apkAsset = assets.find(
    (a): a is { name: string; browser_download_url: string } =>
      typeof (a as { name?: unknown })?.name === 'string' &&
      (a as { name: string }).name.toLowerCase().endsWith('.apk')
  );
  return {
    version: tagName.replace(/^v/i, ''),
    tagName,
    notes: typeof data?.body === 'string' ? data.body.trim() : '',
    apkUrl: apkAsset?.browser_download_url ?? null,
    pageUrl:
      typeof data?.html_url === 'string'
        ? data.html_url
        : UpdateConfig.RELEASES_PAGE,
    publishedAt: typeof data?.published_at === 'string' ? data.published_at : '',
  };
}

/** Check whether a newer release exists than the version running now. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const latest = await fetchLatestRelease();
  const updateAvailable =
    !!latest &&
    latest.version.length > 0 &&
    compareVersions(latest.version, CURRENT_VERSION) > 0;
  return { updateAvailable, currentVersion: CURRENT_VERSION, latest };
}

/** Download the release APK and hand it to the Android package installer. */
export async function downloadAndInstall(
  release: ReleaseInfo,
  onProgress?: DownloadProgressCallback
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('In-app updates are only supported on Android.');
  }
  if (!release.apkUrl) {
    throw new Error('This release has no APK file attached.');
  }
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Storage is unavailable on this device.');
  }

  const target = `${cacheDir}digi2fm-${release.version || 'update'}.apk`;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) {
    await FileSystem.deleteAsync(target, { idempotent: true });
  }

  const download = FileSystem.createDownloadResumable(
    release.apkUrl,
    target,
    {},
    (progress) => {
      const total = progress.totalBytesExpectedToWrite;
      if (onProgress && total > 0) {
        onProgress(Math.min(1, progress.totalBytesWritten / total));
      }
    }
  );

  const result = await download.downloadAsync();
  if (!result?.uri) {
    throw new Error('The update download did not complete.');
  }

  // A content:// URI is required; Android blocks installing from file:// URIs.
  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
