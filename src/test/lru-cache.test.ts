import { describe, expect, it } from 'vitest';
import { SimpleLRUCache } from '../../server/lruCache';

describe('SimpleLRUCache', () => {
  it('stores and retrieves items', () => {
    const cache = new SimpleLRUCache<string, number>({ maxEntries: 3, ttlMs: 10_000 });
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBeUndefined();
  });

  it('evicts least recently used item when maxEntries is reached', () => {
    const cache = new SimpleLRUCache<string, number>({ maxEntries: 2, ttlMs: 10_000 });
    cache.set('a', 1);
    cache.set('b', 2);

    // Access 'a' to make 'b' the oldest
    cache.get('a');

    // Add 'c', should evict 'b'
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('expires entries after ttlMs', async () => {
    const cache = new SimpleLRUCache<string, string>({ maxEntries: 5, ttlMs: 1000 });
    cache.set('temp', 'val');

    expect(cache.has('temp')).toBe(true);
    expect(cache.get('temp')).toBe('val');

    // Manually test expiration by manipulating internal time or entry
    (cache as any).map.get('temp').expiresAt = Date.now() - 10;
    expect(cache.get('temp')).toBeUndefined();
    expect(cache.has('temp')).toBe(false);
  });

  it('deletes and clears correctly', () => {
    const cache = new SimpleLRUCache<number, string>({ maxEntries: 10, ttlMs: 5000 });
    cache.set(1, 'one');
    cache.set(2, 'two');
    expect(cache.size).toBe(2);

    cache.delete(1);
    expect(cache.get(1)).toBeUndefined();
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get(2)).toBeUndefined();
  });
});
