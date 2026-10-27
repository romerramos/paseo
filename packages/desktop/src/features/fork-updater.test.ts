import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: {} }));

import { parseForkRelease } from "./fork-updater";

const release = {
  tag_name: "0.13.2-ruby.4",
  body: "Paseo v0.13.2 with Ruby highlighting.",
  published_at: "2026-10-27T12:00:00Z",
  assets: [
    { name: "Paseo-mac-arm64.zip", browser_download_url: "https://example.com/arm64.zip" },
    { name: "Paseo-mac-x64.zip", browser_download_url: "https://example.com/x64.zip" },
  ],
};

describe("parseForkRelease", () => {
  it("picks the zip for this Mac's architecture", () => {
    expect(parseForkRelease(release, "arm64")).toEqual({
      tag: "0.13.2-ruby.4",
      notes: "Paseo v0.13.2 with Ruby highlighting.",
      date: "2026-10-27T12:00:00Z",
      zipUrl: "https://example.com/arm64.zip",
    });
  });

  it("finds no update when the release has no zip for this architecture", () => {
    expect(parseForkRelease({ ...release, assets: [] }, "arm64")).toBeNull();
  });
});
