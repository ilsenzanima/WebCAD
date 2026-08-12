"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer, type ProgressStatus } from "@capacitor/file-transfer";

interface AppUpdaterPlugin {
  installApk(options: { path: string }): Promise<{ started: boolean }>;
}

// Native Android plugin registered in android/app/.../AppUpdaterPlugin.java,
// launches the system package installer on a downloaded APK.
const AppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

const APK_FILE_NAME = "webcad-update.apk";
const APK_DOWNLOAD_PATH = "/downloads/webcad-alpha.apk";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

// Version of the native shell actually installed on the device (from the
// Android package's versionName), as opposed to appVersion.version which
// reflects whatever web build is currently deployed.
export async function getInstalledVersion(): Promise<string | null> {
  if (!isNativeApp()) return null;
  const info = await App.getInfo();
  return info.version;
}

export function isNewerVersion(latest: string, installed: string): boolean {
  const latestParts = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const installedParts = installed.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(latestParts.length, installedParts.length);
  for (let i = 0; i < len; i++) {
    const a = latestParts[i] ?? 0;
    const b = installedParts[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

export async function downloadAndInstallUpdate(
  onProgress?: (percent: number | null) => void
): Promise<void> {
  const apkUrl = `${window.location.origin}${APK_DOWNLOAD_PATH}`;

  const { uri } = await Filesystem.getUri({
    path: APK_FILE_NAME,
    directory: Directory.Cache,
  });

  const progressListener = onProgress
    ? await FileTransfer.addListener("progress", (status: ProgressStatus) => {
        if (status.lengthComputable && status.contentLength > 0) {
          onProgress(Math.round((status.bytes / status.contentLength) * 100));
        } else {
          onProgress(null);
        }
      })
    : null;

  try {
    await FileTransfer.downloadFile({ url: apkUrl, path: uri, progress: true });
  } finally {
    await progressListener?.remove();
  }

  await AppUpdater.installApk({ path: uri });
}
