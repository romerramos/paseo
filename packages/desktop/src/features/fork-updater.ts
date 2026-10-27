import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { app } from "electron";
import { z } from "zod";
import type {
  AppUpdateInstallRequest,
  AppUpdateRuntime,
  AppUpdateRuntimeConfiguration,
  RuntimeUpdateCheckResult,
  RuntimeUpdateInfo,
} from "./app-update-service.js";

// Ruby fork: updates come from the GitHub releases of romerramos/paseo. The official updater
// only installs builds signed with Paseo's Apple certificate, which these builds don't have.
const LATEST_RELEASE_URL = "https://api.github.com/repos/romerramos/paseo/releases/latest";

const releaseSchema = z.object({
  tag_name: z.string(),
  body: z.string().nullish(),
  published_at: z.string().nullish(),
  assets: z.array(z.object({ name: z.string(), browser_download_url: z.string() })),
});

export interface ForkRelease {
  tag: string;
  notes: string | null;
  date: string | null;
  zipUrl: string;
}

export function parseForkRelease(json: unknown, arch: string): ForkRelease | null {
  const release = releaseSchema.parse(json);
  const zip = release.assets.find((asset) => asset.name === `Paseo-mac-${arch}.zip`);
  if (!zip) return null;
  return {
    tag: release.tag_name,
    notes: release.body ?? null,
    date: release.published_at ?? null,
    zipUrl: zip.browser_download_url,
  };
}

/** The release this app was built as, set by the release workflow; null in other builds. */
export function installedRelease(): string | null {
  try {
    const pkg = JSON.parse(readFileSync(path.join(app.getAppPath(), "package.json"), "utf8"));
    return typeof pkg.paseoRubyRelease === "string" ? pkg.paseoRubyRelease : null;
  } catch {
    return null;
  }
}

function toInfo(release: ForkRelease): RuntimeUpdateInfo {
  return { version: release.tag, releaseNotes: release.notes, releaseDate: release.date };
}

async function downloadApp(zipUrl: string): Promise<string> {
  const response = await fetch(zipUrl);
  if (!response.ok) throw new Error(`Update download failed with status ${response.status}`);
  const dir = await mkdtemp(path.join(os.tmpdir(), "paseo-update-"));
  const zip = path.join(dir, "Paseo.zip");
  await writeFile(zip, Buffer.from(await response.arrayBuffer()));
  await promisify(execFile)("/usr/bin/ditto", ["-x", "-k", zip, dir]);
  return path.join(dir, "Paseo.app");
}

export class ForkAppUpdateRuntime implements AppUpdateRuntime {
  private config: AppUpdateRuntimeConfiguration | null = null;
  private latest: ForkRelease | null = null;
  private download: { tag: string; app: Promise<string> } | null = null;
  private downloadedApp: string | null = null;
  private installing = false;

  configure(input: AppUpdateRuntimeConfiguration): void {
    this.config = input;
  }

  async checkForUpdates(): Promise<RuntimeUpdateCheckResult | null> {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`Update check failed with status ${response.status}`);
    const release = parseForkRelease(await response.json(), process.arch);
    if (!release) return null;

    this.latest = release;
    const isUpdateAvailable = release.tag !== installedRelease();
    // Download in the background, like the official updater, so it can install on quit.
    if (isUpdateAvailable) this.downloadUpdate().catch(() => undefined);
    return { isUpdateAvailable, updateInfo: toInfo(release) };
  }

  downloadUpdate(): Promise<unknown> {
    const release = this.latest;
    if (!release) return Promise.reject(new Error("Check for updates first."));
    if (this.download?.tag === release.tag) return this.download.app;

    const download = { tag: release.tag, app: downloadApp(release.zipUrl) };
    this.download = download;
    download.app.then(
      (appPath) => {
        this.downloadedApp = appPath;
        this.config?.onUpdateDownloaded(toInfo(release));
        return appPath;
      },
      (error) => {
        if (this.download === download) this.download = null;
        this.config?.onError(error);
      },
    );
    return download.app;
  }

  quitAndInstall({ isForceRunAfter }: AppUpdateInstallRequest): void {
    if (this.downloadedApp && !this.installing) {
      this.installing = true;
      const bundle = path.resolve(process.execPath, "../../..");
      // Waits for Paseo to exit, swaps the app (putting the old one back if that fails),
      // then relaunches it when asked.
      const script = [
        `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.5; done`,
        `mv "$1" "$2.old" && { mv "$2" "$1" || mv "$2.old" "$1"; }`,
        `rm -rf "$2.old"`,
        isForceRunAfter ? `open "$1"` : "",
      ].join("\n");
      spawn("/bin/sh", ["-c", script, "sh", bundle, this.downloadedApp], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }
    app.quit();
  }
}
