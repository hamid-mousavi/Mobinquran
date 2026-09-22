import type { MushafLayoutPack, MushafPageData } from '../types/mushafLayout';

let cachePromise: Promise<MushafLayoutPack | null> | null = null;

const PACK_URL = `${import.meta.env.BASE_URL}data/mushaf-layout-v1.json`;

export function loadMushafLayoutPack(): Promise<MushafLayoutPack | null> {
  if (!cachePromise) {
    cachePromise = (async () => {
      try {
        const res = await fetch(PACK_URL);
        if (!res.ok) return null;
        const pack = (await res.json()) as MushafLayoutPack;
        return pack.id === 'mushaf-layout' ? pack : null;
      } catch {
        return null;
      }
    })();
  }
  return cachePromise;
}

export async function loadMushafPage(pageNumber: number): Promise<MushafPageData | null> {
  const pack = await loadMushafLayoutPack();
  if (!pack) return null;
  return pack.pages.find((p) => p.page === pageNumber) ?? null;
}