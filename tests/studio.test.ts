import { describe, it, expect } from "vitest";
import { playerDocument } from "../src/studio/document";
describe("app player isolation", () => {
  it("preserves standards mode and installs storage before app scripts", () => {
    const doc = playerDocument('<!DOCTYPE html><html><head><script>localStorage.getItem("x")</script></head><body></body></html>');
    const frame = doc.match(/srcdoc="([\s\S]*?)"><\/iframe>/)![1];
    expect(frame.startsWith("&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;")).toBe(true);
    expect(frame.indexOf("Object.defineProperty(window,'localStorage'")).toBeLessThan(frame.indexOf("localStorage.getItem"));
    expect(frame.match(/!doctype/gi)).toHaveLength(1);
  });
  it("keeps arbitrary HTML inside an opaque iframe, with scripts and WebGL available", () => {
    const source =
      '</iframe><script>window.top.location="https://example.com"</script>';
    const doc = playerDocument(source);
    expect(doc).toContain('sandbox="allow-scripts allow-pointer-lock"');
    expect(doc).not.toContain("allow-same-origin");
    expect(doc).not.toContain(source);
    expect(doc).toContain("&lt;/iframe&gt;");
  });
});
