import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import { useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { listResources, deleteResource, ensureAccountUnlocked } from '../api/qortal';
import { ResourceViewerDialog } from '../components/ResourceViewerDialog';
import { PublishDialog } from './PublishPage';
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
  onView,
  onDelete,
}: {
  r: QdnResource;
  last: boolean;
  onView: () => void;
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
        {r.title && (
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.identifier}
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
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [deleteTarget, setDeleteTarget] = useState<QdnResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<QdnResource | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const load = useCallback(async (name: string) => {
    setLoading(true);
    const res = await listResources(name);
    setResources(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (account?.name) load(account.name);
  }, [account, load]);

  const serviceTypes = ['ALL', ...Array.from(new Set(resources.map(r => r.service))).sort()];

  const filtered = serviceFilter === 'ALL'
    ? resources
    : resources.filter(r => r.service === serviceFilter);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (!await ensureAccountUnlocked()) return;
      await deleteResource(deleteTarget.service, deleteTarget.name, deleteTarget.identifier);
      setResources(prev => prev.filter(r =>
        !(r.service === deleteTarget.service && r.identifier === deleteTarget.identifier)
      ));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (!account) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 48}px`, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} sx={{ color: c.accent }} />
      </Box>
    );
  }

  if (!account.name) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 48}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
          You need a registered Qortal name to publish QDN resources.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.5rem', letterSpacing: '-0.02em', color: c.textPrimary, lineHeight: 1 }}>
            My Publishes
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mt: 0.5 }}>
            {account.name}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton
            onClick={() => load(account.name!)}
            disabled={loading}
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
              key={`${r.service}-${r.identifier}`}
              r={r}
              last={i === filtered.length - 1}
              onView={() => setViewTarget(r)}
              onDelete={e => { e.stopPropagation(); setDeleteTarget(r); }}
            />
          ))
        )}
      </Box>

      {filtered.length > 0 && (
        <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary, mt: 1, textAlign: 'right' }}>
          {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
        </Typography>
      )}

      {viewTarget && (
        <ResourceViewerDialog resource={viewTarget} onClose={() => setViewTarget(null)} />
      )}

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
