import { getSiteBaseUrl } from "@/lib/site-url";
import { buildMarketingMetadata } from "@/lib/marketing-metadata";

describe("site-url and marketing metadata", () => {
  test("normalizes and falls back site base url", () => {
    expect(getSiteBaseUrl("base25.app/")).toBe("https://base25.app");
    expect(getSiteBaseUrl("https://example.com/path")).toBe("https://example.com");
    expect(getSiteBaseUrl("not a valid url")).toBe("https://base25.app");
    expect(getSiteBaseUrl("")).toBe("https://base25.app");
  });

  test("buildMarketingMetadata produces canonical + OG fields", () => {
    const metadata = buildMarketingMetadata({
      title: "Title",
      description: "Description",
      path: "/pricing",
    });

    expect(metadata.title).toBe("Title");
    expect(metadata.description).toBe("Description");
    expect(metadata.alternates.canonical).toBe("/pricing");
    expect(metadata.openGraph.url).toContain("/pricing");
    expect(metadata.twitter.card).toBe("summary_large_image");
  });
});
