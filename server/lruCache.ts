interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class SimpleLRUCache<K, V> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly map: Map<K, CacheEntry<V>>;

  constructor(options: { maxEntries: number; ttlMs: number }) {
    this.maxEntries = Math.max(1, options.maxEntries);
    this.ttlMs = Math.max(1000, options.ttlMs);
    this.map = new Map<K, CacheEntry<V>>();
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }

    // Move to most recently used (delete and re-insert)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      // Evict oldest (first key in map iteration order)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
