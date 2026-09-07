import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, CircularProgress, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, TextField, MenuItem, Checkbox,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { searchResources, deleteResource, ensureAccountUnlocked, getNamesByAddress, getResource } from '../api/qortal';
import { ResourceViewerDialog } from '../components/ResourceViewerDialog';
import { PublishDialog } from './PublishPage';
import { EditDialog } from './EditDialog';
import { buildPattern, parsePattern } from '../lib/qdnPattern';
import { DEFAULT_SERVICE_TYPES, type QdnResource } from '../types';

const THUMBNAIL_SERVICES = new Set(['IMAGE', 'THUMBNAIL', 'GIF_REPOSITORY']);

function resourceThumbnailUrl(r: QdnResource): string {
  return `/arbitrary/${r.service}/${encodeURIComponent(r.name)}/${encodeURIComponent(r.identifier)}`;
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch { return false; }
}

const PAGE_SIZE = 50;

function resourceKey(r: QdnResource): string {
  return `${r.name}-${r.service}-${r.identifier}`;
}

function buildQdnUrl(r: QdnResource): string {
  const id = r.identifier && r.identifier !== 'default' ? `/${encodeURIComponent(r.identifier)}` : '';
  return `qdn://${r.service}/${encodeURIComponent(r.name)}${id}`;
}

function formatDate(ts: number | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function UploadRow({
  r,
  last,
  showName,
  selected,
  highlighted,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
  rowRef,
}: {
  r: QdnResource;
  last: boolean;
  showName: boolean;
  selected: boolean;
  highlighted: boolean;
  onView: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleSelect: (e: React.SyntheticEvent) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const c = useColors();
  const [copied, setCopied] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = THUMBNAIL_SERVICES.has(r.service) && !thumbFailed;

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await copyText(buildQdnUrl(r));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <Box
      ref={rowRef}
      onClick={onView}
      sx={{
        px: 2.5, py: 1.75,
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: last ? 'none' : `1px solid ${c.borderLight}`,
        borderLeft: `3px solid ${highlighted ? c.accent : 'transparent'}`,
        bgcolor: highlighted ? `${c.accent}0d` : 'transparent',
        cursor: 'pointer',
        '&:hover': { bgcolor: highlighted ? `${c.accent}1a` : c.borderLight },
        transition: '0.12s ease',
      }}
    >
      <Checkbox
        size="small"
        checked={selected}
        onClick={e => e.stopPropagation()}
        onChange={onToggleSelect}
        sx={{
          p: 0.5, flexShrink: 0,
          color: c.borderLight,
          '&.Mui-checked': { color: c.accent },
        }}
      />

      {showThumb ? (
        <Box
          component="img"
          src={resourceThumbnailUrl(r)}
          alt=""
          loading="lazy"
          onError={() => setThumbFailed(true)}
          sx={{
            width: 34, height: 34, borderRadius: '6px', objectFit: 'cover',
            flexShrink: 0, bgcolor: c.borderLight,
          }}
        />
      ) : (
        <Box
          sx={{
            fontSize: '0.6rem', fontWeight: tokens.typography.weightBold,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            bgcolor: c.borderLight, color: c.textSecondary,
            px: 1, py: 0.25, borderRadius: '4px', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {r.service}
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.title || r.identifier}
        </Typography>
        {(showName || r.title) && (
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {showName ? `${r.name} / ${r.identifier}` : r.identifier}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 0.25 }}>
        <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
          {formatDate(r.created)}
        </Typography>
        {r.size !== undefined && (
          <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
            {formatBytes(r.size)}
          </Typography>
        )}
      </Box>

      <Tooltip title={copied ? 'Copied!' : 'Copy link'}>
        <IconButton
          size="small"
          onClick={handleCopyLink}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            color: copied ? c.accent : c.textSecondary,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
            transition: '0.12s ease',
            flexShrink: 0,
          }}
        >
          {copied ? <CheckIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Edit">
        <IconButton
          size="small"
          onClick={onEdit}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            color: c.textSecondary,
            '&:hover': { color: c.accent, bgcolor: c.borderLight },
            transition: '0.12s ease',
            flexShrink: 0,
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Delete">
        <IconButton
          size="small"
          onClick={onDelete}
          sx={{
            borderRadius: `${tokens.shape.radius}px`,
            color: c.textSecondary,
            '&:hover': { color: c.error, bgcolor: `${c.error}18` },
            transition: '0.12s ease',
            flexShrink: 0,
          }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function MyUploadsPage() {
  const c = useColors();
  const account = useAtomValue(accountAtom);
  const [searchParams, setSearchParams] = useSearchParams();

  const [resources, setResources] = useState<QdnResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [serviceFilter, setServiceFilter] = useState(() => searchParams.get('service') ?? 'ALL');
  const [nameFilter, setNameFilter] = useState(() => searchParams.get('name') ?? 'ALL');
  const [editTarget, setEditTarget] = useState<QdnResource | null>(null);
  const [editReturnToViewer, setEditReturnToViewer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QdnResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<QdnResource | null>(null);
  const [lastViewedKey, setLastViewedKey] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(() => searchParams.get('publish') === '1');
  const [ownedNames, setOwnedNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const didLoadAccount = useRef(false);

  // Deep link into the viewer/edit dialog on first mount, resolved via a
  // direct fetch rather than depending on the resource being in the
  // currently-loaded/filtered page (it may not be, e.g. across a reload).
  useEffect(() => {
    const resourceParam = searchParams.get('resource');
    const editParam = searchParams.get('edit');
    const pattern = resourceParam ?? editParam;
    if (!pattern) return;
    const { service, name, identifier } = parsePattern(pattern);
    getResource(service, name, identifier).then(r => {
      if (!r) return;
      if (resourceParam) setViewTarget(r); else setEditTarget(r);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with filters and which dialog (if any) is open, so
  // every page state / dialog combo is a shareable, reloadable link. Only
  // ever touches the keys this page owns - the publish dialog manages its
  // own `publish*` draft params independently, so they're left alone here
  // rather than being wiped out on every filter change.
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (serviceFilter !== 'ALL') next.set('service', serviceFilter); else next.delete('service');
      if (nameFilter !== 'ALL') next.set('name', nameFilter); else next.delete('name');
      if (viewTarget) {
        next.set('resource', buildPattern(viewTarget.service, viewTarget.name, viewTarget.identifier));
        next.delete('edit');
      } else if (editTarget) {
        next.set('edit', buildPattern(editTarget.service, editTarget.name, editTarget.identifier));
        next.delete('resource');
      } else {
        next.delete('resource');
        next.delete('edit');
      }
      if (publishOpen) next.set('publish', '1'); else next.delete('publish');
      return next;
    }, { replace: true });
  }, [serviceFilter, nameFilter, viewTarget, editTarget, publishOpen, setSearchParams]);

  // Paging in a long list (and the delete flow) can leave the user scrolled
  // far down - a fixed "back to top" button beats hunting for a scrollbar.
  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 480); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Every publish type (service) is applicable to every registered name, so
  // resources are fetched across ALL of the user's owned names at once -
  // "My Publishes" should show everything, not just one name at a time.
  // Fetched in pages (limit grows by PAGE_SIZE per "Load more" click) rather
  // than all at once, since some accounts may have a very large publish history.
  //
  // Uses SEARCH_QDN_RESOURCES (mode=ALL), not LIST_QDN_RESOURCES: the core
  // only orders LIST_QDN_RESOURCES by name, never by publish time, so once
  // filtered to a single name every row ties on that sort key and the actual
  // order falls back to arbitrary DB scan order. The newest publish wouldn't
  // reliably appear until every one of that name's resources had been paged
  // in. SEARCH_QDN_RESOURCES orders by created_when for real, so the first
  // page already contains the newest items.
  const load = useCallback(async (names: string[], limit: number, service: string, background = false) => {
    if (names.length === 0) return;
    if (background) setLoadingMore(true); else setLoading(true);
    const results = await Promise.all(names.map(n => searchResources({
      name: n,
      exactMatchNames: true,
      mode: 'ALL',
      service: service === 'ALL' ? undefined : service,
      limit,
      offset: 0,
    })));
    // A name whose page came back full may still have more beyond this limit.
    setHasMore(results.some(r => r.length === limit));
    setResources(results.flat().sort((a, b) => (b.created ?? 0) - (a.created ?? 0)));
    if (background) setLoadingMore(false); else setLoading(false);
  }, []);

  useEffect(() => {
    if (!account?.address) return;
    getNamesByAddress(account.address).then(names => {
      setOwnedNames(names);
      setPageLimit(PAGE_SIZE);
      // Honor a URL-provided ?service= filter on first load; a later account
      // switch (not a fresh page load) still resets to showing everything.
      const initialService = didLoadAccount.current ? 'ALL' : serviceFilter;
      if (didLoadAccount.current) setServiceFilter('ALL');
      didLoadAccount.current = true;
      load(names, PAGE_SIZE, initialService);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, load]);

  const loadMore = useCallback(() => {
    const next = pageLimit + PAGE_SIZE;
    setPageLimit(next);
    load(ownedNames, next, serviceFilter, true);
  }, [pageLimit, ownedNames, serviceFilter, load]);

  // Switching service type re-fetches scoped to that type, correctly ordered
  // newest-first, rather than filtering whatever partial page happened to
  // already be loaded under the old (unscoped) fetch.
  function handleServiceFilterChange(s: string) {
    setServiceFilter(s);
    setPageLimit(PAGE_SIZE);
    load(ownedNames, PAGE_SIZE, s);
  }

  // Every publishable service type is always offered as a filter chip, not
  // just the ones present in the currently loaded page, so a type with zero
  // (or not-yet-loaded) publishes is still selectable.
  const serviceTypes = ['ALL', ...DEFAULT_SERVICE_TYPES.map(s => s.value)];

  const filtered = resources.filter(r => nameFilter === 'ALL' || r.name === nameFilter);

  // Selection is scoped to the currently filtered view, so a filter change
  // clears it rather than leaving an invisible, stale count behind.
  useEffect(() => {
    setSelected(new Set());
  }, [serviceFilter, nameFilter]);

  // Once the viewer dialog closes, scroll back to and highlight whatever was
  // last looked at so it's not lost in a long list.
  useEffect(() => {
    if (viewTarget || !lastViewedKey) return;
    rowRefs.current.get(lastViewedKey)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [viewTarget, lastViewedKey]);

  const viewIndex = viewTarget ? filtered.findIndex(r => resourceKey(r) === resourceKey(viewTarget)) : -1;
  const hasPrevView = viewIndex > 0;
  const hasNextView = viewIndex >= 0 && viewIndex < filtered.length - 1;

  function handleCloseViewer() {
    if (viewTarget) setLastViewedKey(resourceKey(viewTarget));
    setViewTarget(null);
  }

  // Editing from inside the viewer hands off to the (separate) edit dialog
  // rather than duplicating its form there, then hands back to the viewer
  // afterward so the "sift through and act on items" flow isn't broken.
  function handleViewerEdit() {
    if (!viewTarget) return;
    setEditTarget(viewTarget);
    setEditReturnToViewer(true);
    setViewTarget(null);
  }

  function handleEditDialogClose() {
    if (editReturnToViewer && editTarget) {
      const key = resourceKey(editTarget);
      setViewTarget(resources.find(r => resourceKey(r) === key) ?? editTarget);
    }
    setEditTarget(null);
    setEditReturnToViewer(false);
  }

  function handleViewerNavigate(direction: 'prev' | 'next') {
    if (viewIndex < 0) return;
    const next = filtered[direction === 'prev' ? viewIndex - 1 : viewIndex + 1];
    if (next) setViewTarget(next);
  }

  // Deleting from inside the viewer auto-advances to whatever slides into the
  // deleted item's spot, so sifting through publishes doesn't bounce back to
  // the list after every delete.
  async function handleViewerDelete() {
    if (!viewTarget) return;
    if (!await ensureAccountUnlocked()) throw new Error('Account is locked.');
    await deleteResource(viewTarget.service, viewTarget.name, viewTarget.identifier);
    const key = resourceKey(viewTarget);
    const idx = filtered.findIndex(r => resourceKey(r) === key);
    const remaining = filtered.filter(r => resourceKey(r) !== key);
    setResources(prev => prev.filter(r => resourceKey(r) !== key));
    setSelected(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (remaining.length === 0) {
      setLastViewedKey(null);
      setViewTarget(null);
    } else {
      setViewTarget(remaining[Math.min(idx, remaining.length - 1)]);
    }
  }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!await ensureAccountUnlocked()) return;
      await deleteResource(deleteTarget.service, deleteTarget.name, deleteTarget.identifier);
      const key = resourceKey(deleteTarget);
      setResources(prev => prev.filter(r => resourceKey(r) !== key));
      setSelected(prev => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleBulkDelete() {
    const targets = resources.filter(r => selected.has(resourceKey(r)));
    setBulkDeleting(true);
    setBulkProgress({ done: 0, total: targets.length });
    try {
      if (!await ensureAccountUnlocked()) return;
      for (const r of targets) {
        await deleteResource(r.service, r.name, r.identifier);
        const key = resourceKey(r);
        setResources(prev => prev.filter(x => resourceKey(x) !== key));
        setSelected(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setBulkProgress(p => p ? { done: p.done + 1, total: p.total } : p);
      }
    } finally {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
      setBulkProgress(null);
    }
  }

  if (!account) {
    return (
      <Box sx={{ pt: `calc(var(--publish-top-bar-height, ${tokens.spacing.topBarHeight}px) + 48px)`, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} sx={{ color: c.accent }} />
      </Box>
    );
  }

  if (!account.name) {
    return (
      <Box sx={{ pt: `calc(var(--publish-top-bar-height, ${tokens.spacing.topBarHeight}px) + 48px)`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
          You need a registered Qortal name to publish QDN resources.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: `calc(var(--publish-top-bar-height, ${tokens.spacing.topBarHeight}px) + 24px)`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.5rem', letterSpacing: '-0.02em', color: c.textPrimary, lineHeight: 1 }}>
            My Publishes
          </Typography>
          <TextField
            select
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            size="small"
            disabled={ownedNames.length <= 1}
            slotProps={{
              htmlInput: { sx: { fontSize: '0.75rem', color: c.textSecondary, py: '2px', pl: ownedNames.length > 1 ? undefined : 0 } },
            }}
            sx={{
              mt: 0.5,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'transparent',
                '& fieldset': { borderColor: ownedNames.length > 1 ? c.borderLight : 'transparent', borderWidth: tokens.shape.borderWidth },
                '&:hover fieldset': { borderColor: ownedNames.length > 1 ? c.accent : 'transparent' },
                '&.Mui-focused fieldset': { borderColor: c.accent },
              },
              '& .MuiSelect-icon': { display: ownedNames.length > 1 ? undefined : 'none' },
            }}
          >
            <MenuItem value="ALL" sx={{ fontSize: '0.8rem' }}>All names</MenuItem>
            {ownedNames.map(n => (
              <MenuItem key={n} value={n} sx={{ fontSize: '0.8rem' }}>{n}</MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => load(ownedNames, pageLimit, serviceFilter)}
            disabled={loading || ownedNames.length === 0}
            sx={{ borderRadius: `${tokens.shape.radius}px`, color: c.textSecondary, '&:hover': { color: c.accent, bgcolor: c.borderLight } }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Publish new">
          <IconButton
            onClick={() => setPublishOpen(true)}
            sx={{ borderRadius: `${tokens.shape.radius}px`, color: c.textSecondary, '&:hover': { color: c.accent, bgcolor: c.borderLight } }}
          >
            <CloudUploadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
        {serviceTypes.map(s => (
          <Chip
            key={s}
            label={s}
            size="small"
            onClick={() => handleServiceFilterChange(s)}
            sx={{
              fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.08em',
              textTransform: 'uppercase', borderRadius: '50px',
              bgcolor: serviceFilter === s ? c.accent : 'transparent',
              color: serviceFilter === s ? c.accentText : c.textSecondary,
              border: `1.5px solid ${serviceFilter === s ? c.accent : c.borderLight}`,
              cursor: 'pointer',
              '&:hover': { bgcolor: serviceFilter === s ? c.accentHover : c.borderLight },
            }}
          />
        ))}
      </Box>

      {selected.size > 0 && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            mb: 1.5, px: 2, py: 1,
            border: `${tokens.shape.borderWidth} solid ${c.accent}`,
            borderRadius: `${tokens.shape.radius}px`,
            bgcolor: `${c.accent}12`,
          }}
        >
          <Typography sx={{ fontSize: '0.78rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
            {selected.size} selected
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              onClick={() => setSelected(new Set())}
              sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
            >
              Clear
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<DeleteIcon fontSize="small" />}
              onClick={() => setBulkDeleteOpen(true)}
              sx={{ bgcolor: c.error, color: '#fff', borderRadius: '50px', '&:hover': { bgcolor: '#c0392b' } }}
            >
              Delete selected
            </Button>
          </Box>
        </Box>
      )}

      <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: c.accent }} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary, mb: 1.5 }}>
              No published resources found.
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<CloudUploadIcon />}
              onClick={() => setPublishOpen(true)}
              disableElevation
              sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', '&:hover': { bgcolor: c.accentHover } }}
            >
              Publish something
            </Button>
          </Box>
        ) : (
          filtered.map((r, i) => {
            const key = resourceKey(r);
            return (
              <UploadRow
                key={key}
                r={r}
                showName={ownedNames.length > 1}
                last={i === filtered.length - 1}
                selected={selected.has(key)}
                highlighted={key === lastViewedKey}
                onView={() => setViewTarget(r)}
                onEdit={e => { e.stopPropagation(); setEditTarget(r); }}
                onDelete={e => { e.stopPropagation(); setDeleteTarget(r); }}
                onToggleSelect={() => toggleSelect(key)}
                rowRef={el => { if (el) rowRefs.current.set(key, el); else rowRefs.current.delete(key); }}
              />
            );
          })
        )}
      </Box>

      {hasMore && !loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            size="small"
            sx={{
              fontSize: '0.7rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.04em',
              textTransform: 'none', borderRadius: '50px', px: 2.5,
              color: c.textSecondary, border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
              '&:hover': { color: c.accent, borderColor: c.accent, bgcolor: c.borderLight },
            }}
          >
            {loadingMore ? <CircularProgress size={14} sx={{ color: c.accent, mr: 1 }} /> : null}
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}

      {filtered.length > 0 && (
        <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary, mt: 1, textAlign: 'right' }}>
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''}{hasMore ? '+' : ''}
        </Typography>
      )}

      {showScrollTop && (
        <Tooltip title="Back to top">
          <IconButton
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            sx={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 20,
              bgcolor: c.accent, color: c.accentText,
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: c.accentHover },
            }}
          >
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {viewTarget && (
        <ResourceViewerDialog
          resource={viewTarget}
          onClose={handleCloseViewer}
          onDelete={handleViewerDelete}
          hasPrev={hasPrevView}
          hasNext={hasNextView}
          onPrev={() => handleViewerNavigate('prev')}
          onNext={() => handleViewerNavigate('next')}
          onEdit={handleViewerEdit}
          ownContent
        />
      )}

      <EditDialog
        open={!!editTarget}
        resource={editTarget}
        onClose={handleEditDialogClose}
        onSuccess={meta => {
          if (editTarget) {
            const key = resourceKey(editTarget);
            setResources(prev => prev.map(r => resourceKey(r) === key ? { ...r, ...meta } : r));
          }
          load(ownedNames, pageLimit, serviceFilter);
        }}
      />

      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{
          sx: { bgcolor: c.surface, border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: 0, minWidth: 340 },
        }}
      >
        <DialogTitle sx={{ px: 3, py: 2, borderBottom: `${tokens.shape.borderWidth} solid ${c.borderLight}`, fontSize: '0.9rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
          Delete resource?
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary, mb: 1 }}>
            This broadcasts a delete transaction to the network. The resource will be permanently removed.
          </Typography>
          {deleteTarget && (
            <Box sx={{ bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`, p: 1.5, mt: 1 }}>
              <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: c.textPrimary }}>
                {deleteTarget.service} / {deleteTarget.identifier}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="contained"
            disableElevation
            sx={{ bgcolor: c.error, color: '#fff', borderRadius: '50px', '&:hover': { bgcolor: '#c0392b' }, opacity: deleting ? 0.4 : 1 }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}
        PaperProps={{
          sx: { bgcolor: c.surface, border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: 0, minWidth: 340 },
        }}
      >
        <DialogTitle sx={{ px: 3, py: 2, borderBottom: `${tokens.shape.borderWidth} solid ${c.borderLight}`, fontSize: '0.9rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
          Delete {selected.size} resource{selected.size !== 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary }}>
            This broadcasts a delete transaction for each selected resource, one at a time. They will be permanently removed.
          </Typography>
          {bulkProgress && (
            <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mt: 1.5 }}>
              Deleting {bulkProgress.done} / {bulkProgress.total}…
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setBulkDeleteOpen(false)}
            disabled={bulkDeleting}
            sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            variant="contained"
            disableElevation
            sx={{ bgcolor: c.error, color: '#fff', borderRadius: '50px', '&:hover': { bgcolor: '#c0392b' }, opacity: bulkDeleting ? 0.4 : 1 }}
          >
            {bulkDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
