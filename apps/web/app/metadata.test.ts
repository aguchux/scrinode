import { describe, expect, it } from 'vitest';
import { metadata } from './metadata';

/**
 * The reader's metadata.
 *
 * What is asserted here is the part that fails silently. A missing Open Graph
 * image does not error — the card simply renders blank, and nobody notices
 * until a link is shared. A relative image URL is worse: every scraper ignores
 * it, so the tag is present and useless.
 */
describe('reader metadata', () => {
  describe('Open Graph', () => {
    it('sets metadataBase, which is what makes relative image paths absolute', () => {
      // Without it, `/opengraph-image.jpg` stays relative in the rendered tag
      // and every scraper ignores it.
      expect(metadata.metadataBase).toBeInstanceOf(URL);
    });

    it('declares an image at the size every platform crops toward', () => {
      const images = metadata.openGraph?.images;
      expect(Array.isArray(images)).toBe(true);

      const first = (images as { width?: number; height?: number; alt?: string }[])[0];
      expect(first?.width).toBe(1200);
      expect(first?.height).toBe(630);
    });

    it('gives the image alt text', () => {
      // Read aloud by screen readers on some platforms, so it describes the
      // image rather than repeating the title (§32).
      const images = metadata.openGraph?.images as { alt?: string }[];
      expect(images[0]?.alt).toBeTruthy();
      expect(images[0]?.alt).not.toBe(metadata.openGraph?.title);
    });

    it('uses the large Twitter card, not the square summary', () => {
      // `summary` crops to a square and loses the layout entirely.
      expect((metadata.twitter as { card?: string })?.card).toBe('summary_large_image');
    });
  });

  describe('search', () => {
    it('lets the reader be indexed', () => {
      // The inverse of Zedek and the backoffice, both of which must not be.
      // Flipping this by accident would remove the site from search.
      expect((metadata.robots as { index?: boolean })?.index).toBe(true);
    });

    it('declares a canonical URL', () => {
      // Without it, a page reached with tracking parameters is indexed as a
      // separate URL competing with itself.
      expect(metadata.alternates?.canonical).toBe('/');
    });

    it('keeps the description inside the length a result will show', () => {
      // Past ~160 characters a search result truncates mid-sentence.
      expect(metadata.description).toBeTruthy();
      expect((metadata.description as string).length).toBeLessThanOrEqual(165);
    });
  });

  describe('icons', () => {
    it('declares an apple-touch-icon at 180x180', () => {
      // iOS composites it onto the home screen at this size. It must also be
      // opaque — a transparent PNG renders as a black square there — which is
      // a property of the file rather than of this declaration.
      const apple = metadata.icons as { apple?: { url: string; sizes?: string }[] };
      expect(apple.apple?.[0]?.sizes).toBe('180x180');
    });

    it('declares icons at the sizes a browser and a launcher each want', () => {
      const icons = metadata.icons as { icon?: { sizes?: string }[] };
      const sizes = icons.icon?.map((entry) => entry.sizes);

      expect(sizes).toContain('32x32');
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });

    it('links the manifest', () => {
      expect(metadata.manifest).toBe('/manifest.webmanifest');
    });
  });

  it('stops iOS turning verse references into phone links', () => {
    // "1 Cor 13" and "2 Sam 7:12" both parse as telephone numbers on iOS,
    // which is a real failure on a page about Scripture.
    expect(metadata.formatDetection?.telephone).toBe(false);
  });
});
