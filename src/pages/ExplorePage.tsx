import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Chip, CircularProgress, IconButton,
  InputAdornment, TextField, Tooltip, Typography,
  Menu, MenuItem, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExploreIcon from '@mui/icons-material/Explore';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import BlockIcon from '@mui/icons-material/Block';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { searchResources, fetchResourceAsBase64, getResource } from '../api/qortal';
import { ResourceViewerDialog } from '../components/ResourceViewerDialog';
import type { QdnResource } from '../types';
import { useQdnLists } from '../hooks/useQdnLists';
import { resourcePatterns } from '../lib/qdnPattern';

const PAGE_SIZE = 20;

const SERVICE_FILTERS = ['ALL', 'APP', 'WEBSITE', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'JSON'];

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

function guessFilename(r: QdnResource): string {
  if (/\.[a-zA-Z0-9]{2,6}$/.test(r.identifier)) return r.identifier;
  return `${r.name}-${r.identifier}`;
}

function triggerDownload(b64: string, filename: string) {
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildQdnUrl(r: QdnResource): string {
  const id = r.identifier && r.identifier !== 'default' ? `/${r.identifier}` : '';
  return `qdn://${r.service}/${r.name}${id}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall through */ }
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

// ─── Block / follow context menu for a row ────────────────────────────────────

type MenuAction = 'idle' | 'busy' | 'done' | 'error';

function RowActionMenu({ r }: { r: QdnResource }) {
  const c = useColors();
  const { block, unblock, follow, unfollow, isBlocked, isFollowed } = useQdnLists();
  const patterns = resourcePatterns(r.service, r.name, r.identifier);

  const [anchor,      setAnchor]      = useState<null | HTMLElement>(null);
  const [actionState, setActionState] = useState<MenuAction>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActionState('done');
    timerRef.current = setTimeout(() => setActionState('idle'), 1600);
  }

  async function doAction(fn: () => Promise<void>) {
    setAnchor(null);
    setActionState('busy');
    try { await fn(); flash(); }
    catch {
      setActionState('error');
      timerRef.current = setTimeout(() => setActionState('idle'), 1600);
    }
  }

  const exactBlocked      = isBlocked(patterns.exact);
  const exactFollowed     = isFollowed(patterns.exact);
  const byNameBlocked     = isBlocked(patterns.byName);
  const byNameFollowed    = isFollowed(patterns.byName);
  const byServiceBlocked  = isBlocked(patterns.byService);

  const iconColor = exactBlocked ? c.error : exactFollowed ? c.accent : c.textSecondary;

  const menuSx = {
    '& .MuiPaper-root': {
      bgcolor: c.surface,
      border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
      borderRadius: `${tokens.shape.radius}px`,
      minWidth: 240,
    },
  };
  const miSx = {
    fontSize: '0.78rem', color: c.textPrimary,
    '&:hover': { bgcolor: c.borderLight },
    display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start',
    py: 0.9, gap: 0,
  };

  return (
    <>
      <Tooltip title={
        actionState === 'busy'  ? 'Saving…'   :
        actionState === 'done'  ? 'Done'       :
        actionState === 'error' ? 'Failed'     :
        'Follow / Block'
      }>
        <span>
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}
            disabled={actionState === 'busy'}
            sx={{
              borderRadius: `${tokens.shape.radius}px`,
              color: actionState === 'done' ? c.accent : actionState === 'error' ? c.error : iconColor,
              '&:hover': { color: c.accent, bgcolor: c.borderLight },
              transition: '0.12s ease',
              flexShrink: 0,
            }}
          >
            {actionState === 'busy'  ? <CircularProgress size={14} sx={{ color: c.accent }} /> :
             actionState === 'done'  ? <CheckIcon fontSize="small" /> :
             exactBlocked            ? <BlockIcon fontSize="small" /> :
             exactFollowed           ? <StarIcon fontSize="small" /> :
                                       <MoreVertIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        onClick={e => e.stopPropagation()}
        sx={menuSx}
      >
        {/* Follow actions */}
        <MenuItem sx={{ ...miSx, color: c.textSecondary, fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', py: 0.4, pointerEvents: 'none' }}>
          Follow
        </MenuItem>

        <MenuItem
          onClick={() => doAction(exactFollowed ? () => unfollow(patterns.exact) : () => follow(patterns.exact))}
          sx={miSx}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <StarBorderIcon sx={{ fontSize: '0.9rem', color: exactFollowed ? c.accent : c.textSecondary }} />
            <Box sx={{ fontWeight: tokens.typography.weightBold, color: exactFollowed ? c.accent : c.textPrimary }}>
              {exactFollowed ? 'Unfollow' : 'Follow'} this resource
            </Box>
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary, pl: 2.25 }}>
            {r.service}/{r.name}/{r.identifier}
          </Box>
        </MenuItem>

        <MenuItem
          onClick={() => doAction(byNameFollowed ? () => unfollow(patterns.byName) : () => follow(patterns.byName))}
          sx={miSx}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <StarBorderIcon sx={{ fontSize: '0.9rem', color: byNameFollowed ? c.accent : c.textSecondary }} />
            <Box sx={{ fontWeight: tokens.typography.weightBold, color: byNameFollowed ? c.accent : c.textPrimary }}>
              {byNameFollowed ? 'Unfollow' : 'Follow'} all by {r.name}
            </Box>
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary, pl: 2.25 }}>
            */{r.name}
          </Box>
        </MenuItem>

        <Divider sx={{ borderColor: c.borderLight, my: 0.5 }} />

        {/* Block actions */}
        <MenuItem sx={{ ...miSx, color: c.textSecondary, fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', py: 0.4, pointerEvents: 'none' }}>
          Block
        </MenuItem>

        <MenuItem
          onClick={() => doAction(exactBlocked ? () => unblock(patterns.exact) : () => block(patterns.exact))}
          sx={miSx}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <BlockIcon sx={{ fontSize: '0.9rem', color: exactBlocked ? c.error : c.textSecondary }} />
            <Box sx={{ fontWeight: tokens.typography.weightBold, color: exactBlocked ? c.error : c.textPrimary }}>
              {exactBlocked ? 'Unblock' : 'Block'} this resource
            </Box>
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary, pl: 2.25 }}>
            {r.service}/{r.name}/{r.identifier}
          </Box>
        </MenuItem>

        <MenuItem
          onClick={() => doAction(byNameBlocked ? () => unblock(patterns.byName) : () => block(patterns.byName))}
          sx={miSx}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <BlockIcon sx={{ fontSize: '0.9rem', color: byNameBlocked ? c.error : c.textSecondary }} />
            <Box sx={{ fontWeight: tokens.typography.weightBold, color: byNameBlocked ? c.error : c.textPrimary }}>
              {byNameBlocked ? 'Unblock' : 'Block'} all by {r.name}
            </Box>
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary, pl: 2.25 }}>
            */{r.name}
          </Box>
        </MenuItem>

        <MenuItem
          onClick={() => doAction(byServiceBlocked ? () => unblock(patterns.byService) : () => block(patterns.byService))}
          sx={miSx}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <BlockIcon sx={{ fontSize: '0.9rem', color: byServiceBlocked ? c.error : c.textSecondary }} />
            <Box sx={{ fontWeight: tokens.typography.weightBold, color: byServiceBlocked ? c.error : c.textPrimary }}>
              {byServiceBlocked ? 'Unblock' : 'Block'} all {r.service}
            </Box>
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary, pl: 2.25 }}>
            {r.service}
          </Box>
        </MenuItem>
      </Menu>
    </>
  );
}

// ─── Resource row ─────────────────────────────────────────────────────────────

function ResourceRow({
  r,
  last,
  onView,
}: {
  r: QdnResource;
  last: boolean;
  onView: (r: QdnResource) => void;
}) {
  const c = useColors();
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError]         = useState(false);
  const [copied, setCopied]           = useState(false);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setDownloading(true);
    setDlError(false);
    try {
      const b64 = await fetchResourceAsBase64(r.service, r.name, r.identifier);
      triggerDownload(b64, guessFilename(r));
    } catch {
      setDlError(true);
      setTimeout(() => setDlError(false), 2500);
    } finally {
      setDownloading(false);
    }
  }

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
      onClick={() => onView(r)}
      sx={{
        px: 2.5, py: 1.75,
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: last ? 'none' : `1px solid ${c.borderLight}`,
        cursor: 'pointer',
        '&:hover': { bgcolor: c.borderLight },
        transition: '0.12s ease',
      }}
    >
      <Box sx={{
        fontSize: '0.58rem', fontWeight: tokens.typography.weightBold,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        bgcolor: c.borderLight, color: c.textSecondary,
        px: 0.75, py: 0.25, borderRadius: '4px',
        whiteSpace: 'nowrap', flexShrink: 0,
        minWidth: 52, textAlign: 'center',
      }}>
        {r.service.length > 8 ? r.service.slice(0, 7) + '…' : r.service}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.title || r.identifier}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.1 }}>
          <Typography sx={{ fontSize: '0.7rem', color: c.accent, fontWeight: tokens.typography.weightMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
            {r.name}
          </Typography>
          {r.description && (
            <Typography sx={{ fontSize: '0.7rem', color: c.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · {r.description}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 0.25 }}>
        <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
          {formatDate(r.created ?? r.updated)}
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

      <Tooltip title={dlError ? 'Download failed' : 'Download'}>
        <span>
          <IconButton
            size="small"
            onClick={handleDownload}
            disabled={downloading}
            sx={{
              borderRadius: `${tokens.shape.radius}px`,
              color: dlError ? c.error : c.textSecondary,
              '&:hover': { color: c.accent, bgcolor: c.borderLight },
              transition: '0.12s ease',
              flexShrink: 0,
            }}
          >
            {downloading
              ? <CircularProgress size={14} sx={{ color: c.accent }} />
              : dlError
                ? <ErrorOutlineIcon fontSize="small" />
                : <DownloadIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>

      <RowActionMenu r={r} />
    </Box>
  );
}

export function ExplorePage() {
  const c = useColors();
  const [searchParams] = useSearchParams();

  const initialName       = searchParams.get('name') ?? '';
  const initialService    = searchParams.get('service') ?? '';
  const initialIdentifier = searchParams.get('identifier') ?? '';
  const isDirectLink = !!(initialName && initialService && initialIdentifier);

  const didInit = useRef(false);

  const [serviceFilter, setServiceFilter]     = useState(isDirectLink ? initialService : 'ALL');
  const [queryInput, setQueryInput]           = useState(initialName);
  const [activeQuery, setActiveQuery]         = useState(initialName);
  const [viewingDirectLink, setViewingDirectLink] = useState(isDirectLink);

  const [results, setResults]         = useState<QdnResource[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [offset, setOffset]           = useState(0);
  const [viewTarget, setViewTarget]   = useState<QdnResource | null>(null);

  const doSearch = useCallback(async (service: string, query: string, replace: boolean) => {
    const currentOffset = replace ? 0 : offset;
    if (replace) setLoading(true); else setLoadingMore(true);

    const res = await searchResources({
      service: service === 'ALL' ? undefined : service,
      query:   query || undefined,
      limit:   PAGE_SIZE,
      offset:  currentOffset,
    });

    if (replace) {
      setResults(res);
      setOffset(res.length);
    } else {
      setResults(prev => [...prev, ...res]);
      setOffset(o => o + res.length);
    }
    setHasMore(res.length === PAGE_SIZE);
    if (replace) setLoading(false); else setLoadingMore(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (isDirectLink) {
      setLoading(true);
      getResource(initialService, initialName, initialIdentifier).then(r => {
        setResults(r ? [r] : []);
        setHasMore(false);
        setLoading(false);
      });
    } else {
      void doSearch('ALL', initialName, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServiceChange(s: string) {
    setServiceFilter(s);
    setViewingDirectLink(false);
    setOffset(0);
    void doSearch(s, activeQuery, true);
  }

  function handleSearch() {
    setActiveQuery(queryInput);
    setViewingDirectLink(false);
    setOffset(0);
    void doSearch(serviceFilter, queryInput, true);
  }

  function handleLoadMore() {
    void doSearch(serviceFilter, activeQuery, false);
  }

  const chipSx = (active: boolean) => ({
    fontSize: '0.65rem', fontWeight: tokens.typography.weightBold,
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    borderRadius: '50px', cursor: 'pointer',
    bgcolor: active ? c.accent : 'transparent',
    color:   active ? c.accentText : c.textSecondary,
    border:  `1.5px solid ${active ? c.accent : c.borderLight}`,
    '&:hover': { bgcolor: active ? c.accentHover : c.borderLight },
  });

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>

      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.5rem', letterSpacing: '-0.02em', color: c.textPrimary, lineHeight: 1 }}>
          Explore
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mt: 0.5 }}>
          Browse published resources on Qortium
        </Typography>
      </Box>

      {/* Service filter chips */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
        {SERVICE_FILTERS.map(s => (
          <Chip
            key={s}
            label={s}
            size="small"
            onClick={() => handleServiceChange(s)}
            sx={chipSx(serviceFilter === s)}
          />
        ))}
      </Box>

      {/* Search bar */}
      <Box sx={{ display: 'flex', gap: 1, mb: viewingDirectLink ? 1.5 : 2.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name, title, or keyword…"
          value={queryInput}
          onChange={e => setQueryInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: '1rem', color: c.textSecondary }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              '& fieldset': { borderColor: c.borderLight },
              '&:hover fieldset': { borderColor: c.accent },
              '&.Mui-focused fieldset': { borderColor: c.accent },
            },
          }}
        />
        <Button
          variant="contained"
          disableElevation
          onClick={handleSearch}
          disabled={loading}
          sx={{
            bgcolor: c.accent, color: c.accentText,
            borderRadius: '50px', px: 2.5, fontSize: '0.75rem', whiteSpace: 'nowrap',
            '&:hover': { bgcolor: c.accentHover },
            '&.Mui-disabled': { opacity: 0.4, bgcolor: c.accent, color: c.accentText },
          }}
        >
          Search
        </Button>
      </Box>

      {/* Direct link banner */}
      {viewingDirectLink && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, mb: 2.5,
          px: 1.5, py: 0.75,
          bgcolor: `${c.accent}12`,
          border: `1px solid ${c.accent}30`,
          borderRadius: `${tokens.shape.radius}px`,
        }}>
          <LinkIcon sx={{ fontSize: '0.8rem', color: c.accent, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.72rem', color: c.accent, flex: 1 }}>
            Viewing a linked resource
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setViewingDirectLink(false);
              setServiceFilter('ALL');
              setQueryInput('');
              setActiveQuery('');
              void doSearch('ALL', '', true);
            }}
            sx={{ fontSize: '0.65rem', color: c.accent, minWidth: 0, p: '2px 8px', borderRadius: '50px', '&:hover': { bgcolor: `${c.accent}20` } }}
          >
            Browse all
          </Button>
        </Box>
      )}

      {/* Results */}
      <Box sx={{ border: `${tokens.shape.borderWidth} solid ${c.borderLight}`, borderRadius: `${tokens.shape.radius}px`, bgcolor: c.surface, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} sx={{ color: c.accent }} />
          </Box>
        ) : results.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <ExploreIcon sx={{ fontSize: '2rem', color: c.textSecondary, opacity: 0.3, mb: 1 }} />
            <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
              No resources found.
            </Typography>
          </Box>
        ) : (
          results.map((r, i) => (
            <ResourceRow
              key={`${r.service}-${r.name}-${r.identifier}`}
              r={r}
              last={i === results.length - 1}
              onView={setViewTarget}
            />
          ))
        )}
      </Box>

      {results.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5, gap: 2 }}>
          <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Typography>
          {hasMore && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleLoadMore}
              disabled={loadingMore}
              sx={{
                ml: 'auto',
                borderColor: c.accent, color: c.accent,
                borderRadius: '50px', fontSize: '0.72rem', px: 2.5,
                '&:hover': { bgcolor: c.borderLight },
                '&.Mui-disabled': { opacity: 0.35 },
              }}
            >
              {loadingMore ? <CircularProgress size={12} sx={{ color: c.accent }} /> : 'Load more'}
            </Button>
          )}
        </Box>
      )}

      {viewTarget && (
        <ResourceViewerDialog resource={viewTarget} onClose={() => setViewTarget(null)} />
      )}

    </Box>
  );
}
