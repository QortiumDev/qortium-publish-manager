import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip, TextField, MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { listResources, deleteResource, ensureAccountUnlocked, getNamesByAddress } from '../api/qortal';
import { ResourceViewerDialog } from '../components/ResourceViewerDialog';
import { PublishDialog } from './PublishPage';
import { EditDialog } from './EditDialog';
import type { QdnResource } from '../types';

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
  onView,
  onEdit,
  onDelete,
}: {
  r: QdnResource;
  last: boolean;
  showName: boolean;
  onView: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const c = useColors();
  const [copied, setCopied] = useState(false);

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
      onClick={onView}
      sx={{
        px: 2.5, py: 1.75,
        display: 'flex', alignItems: 'center', gap: 2,
        borderBottom: last ? 'none' : `1px solid ${c.borderLight}`,
        cursor: 'pointer',
        '&:hover': { bgcolor: c.borderLight },
        transition: '0.12s ease',
      }}
    >
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

  const [resources, setResources] = useState<QdnResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [nameFilter, setNameFilter] = useState('ALL');
  const [editTarget, setEditTarget] = useState<QdnResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QdnResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<QdnResource | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [ownedNames, setOwnedNames] = useState<string[]>([]);

  // Every publish type (service) is applicable to every registered name, so
  // resources are fetched across ALL of the user's owned names at once -
  // "My Publishes" should show everything, not just one name at a time.
  // Fetched in pages (limit grows by PAGE_SIZE per "Load more" click) rather
  // than all at once, since some accounts may have a very large publish history.
  const load = useCallback(async (names: string[], limit: number, background = false) => {
    if (names.length === 0) return;
    if (background) setLoadingMore(true); else setLoading(true);
    const results = await Promise.all(names.map(n => listResources(n, undefined, 0, limit)));
    // A name whose page came back full may still have more beyond this limit.
    setHasMore(results.some(r => r.length === limit));
    // LIST_QDN_RESOURCES orders by name, not by created_when, so sort by recency ourselves.
    setResources(results.flat().sort((a, b) => (b.created ?? 0) - (a.created ?? 0)));
    if (background) setLoadingMore(false); else setLoading(false);
  }, []);

  useEffect(() => {
    if (!account?.address) return;
    getNamesByAddress(account.address).then(names => {
      setOwnedNames(names);
      setPageLimit(PAGE_SIZE);
      load(names, PAGE_SIZE);
    });
  }, [account?.address, load]);

  const loadMore = useCallback(() => {
    const next = pageLimit + PAGE_SIZE;
    setPageLimit(next);
    load(ownedNames, next, true);
  }, [pageLimit, ownedNames, load]);

  const serviceTypes = ['ALL', ...Array.from(new Set(resources.map(r => r.service))).sort()];

  const filtered = resources.filter(r =>
    (serviceFilter === 'ALL' || r.service === serviceFilter) &&
    (nameFilter === 'ALL' || r.name === nameFilter)
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!await ensureAccountUnlocked()) return;
      await deleteResource(deleteTarget.service, deleteTarget.name, deleteTarget.identifier);
      setResources(prev => prev.filter(r =>
        !(r.name === deleteTarget.name && r.service === deleteTarget.service && r.identifier === deleteTarget.identifier)
      ));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
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
            onClick={() => load(ownedNames, pageLimit)}
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

      {serviceTypes.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
          {serviceTypes.map(s => (
            <Chip
              key={s}
              label={s}
              size="small"
              onClick={() => setServiceFilter(s)}
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
          filtered.map((r, i) => (
            <UploadRow
              key={`${r.name}-${r.service}-${r.identifier}`}
              r={r}
              showName={ownedNames.length > 1}
              last={i === filtered.length - 1}
              onView={() => setViewTarget(r)}
              onEdit={e => { e.stopPropagation(); setEditTarget(r); }}
              onDelete={e => { e.stopPropagation(); setDeleteTarget(r); }}
            />
          ))
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

      {viewTarget && (
        <ResourceViewerDialog resource={viewTarget} onClose={() => setViewTarget(null)} />
      )}

      <EditDialog
        open={!!editTarget}
        resource={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => load(ownedNames, pageLimit)}
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

    </Box>
  );
}
