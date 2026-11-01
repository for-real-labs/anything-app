import { describe, it, expect } from "vitest";
import { playerDocument } from "../src/studio/document";
describe("app player isolation", () => {
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
