import { useAtom } from 'jotai';
import { useEffect, useCallback } from 'react';
import { blockedQdnAtom, followedQdnAtom, qdnListsLoadedAtom } from '../state/atoms';
import { getList, addToList, removeFromList } from '../api/qortal';

/**
 * Shared hook for the blockedQdn / followedQdn pattern lists.
 * Backed by Jotai atoms so all components (Explore, viewer, ListsPage) stay in sync.
 * Initialises from the bridge once on first mount.
 */
export function useQdnLists() {
  const [blocked,  setBlocked]  = useAtom(blockedQdnAtom);
  const [followed, setFollowed] = useAtom(followedQdnAtom);
  const [loaded,   setLoaded]   = useAtom(qdnListsLoadedAtom);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    void Promise.all([
      getList('blockedQdn'),
      getList('followedQdn'),
    ]).then(([b, f]) => {
      setBlocked(b);
      setFollowed(f);
    });
  }, [loaded, setBlocked, setFollowed, setLoaded]);

  const block = useCallback(async (pattern: string): Promise<void> => {
    await addToList('blockedQdn', [pattern]);
    setBlocked(prev => prev.includes(pattern) ? prev : [...prev, pattern]);
    // mutually exclusive — remove from followed if present
    if (followed.includes(pattern)) {
      await removeFromList('followedQdn', [pattern]);
      setFollowed(prev => prev.filter(p => p !== pattern));
    }
  }, [followed, setBlocked, setFollowed]);

  const unblock = useCallback(async (pattern: string): Promise<void> => {
    await removeFromList('blockedQdn', [pattern]);
    setBlocked(prev => prev.filter(p => p !== pattern));
  }, [setBlocked]);

  const follow = useCallback(async (pattern: string): Promise<void> => {
    await addToList('followedQdn', [pattern]);
    setFollowed(prev => prev.includes(pattern) ? prev : [...prev, pattern]);
    // mutually exclusive — remove from blocked if present
    if (blocked.includes(pattern)) {
      await removeFromList('blockedQdn', [pattern]);
      setBlocked(prev => prev.filter(p => p !== pattern));
    }
  }, [blocked, setBlocked, setFollowed]);

  const unfollow = useCallback(async (pattern: string): Promise<void> => {
    await removeFromList('followedQdn', [pattern]);
    setFollowed(prev => prev.filter(p => p !== pattern));
  }, [setFollowed]);

  return {
    blocked,
    followed,
    loaded,
    block,
    unblock,
    follow,
    unfollow,
    isBlocked:  (p: string) => blocked.includes(p),
    isFollowed: (p: string) => followed.includes(p),
  };
}
