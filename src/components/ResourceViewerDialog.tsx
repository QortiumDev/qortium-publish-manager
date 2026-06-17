import { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Tooltip,
  Menu, MenuItem, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import BlockIcon from '@mui/icons-material/Block';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { fetchResourceText, fetchResourceAsBase64, openInNewTab } from '../api/qortal';
import { fetchResourceProperties, type ResourceProperties } from '../api/rest';
import type { QdnResource } from '../types';
import { useQdnLists } from '../hooks/useQdnLists';
import { resourcePatterns, patternLabel } from '../lib/qdnPattern';

type ViewerKind = 'image' | 'audio' | 'video' | 'text' | 'app' | 'none';

const KNOWN_IMAGE_SERVICES = new Set(['IMAGE', 'THUMBNAIL']);
const KNOWN_AUDIO_SERVICES = new Set(['AUDIO']);
const KNOWN_VIDEO_SERVICES = new Set(['VIDEO']);
const KNOWN_APP_SERVICES   = new Set(['APP', 'WEBSITE']);
const BINARY_MIME_RE = /\b(pdf|zip|tar|gz|rar|7z|exe|dll|wasm|sqlite|octet-stream)\b/i;

function resolveViewerKind(service: string, mimeType?: string): ViewerKind {
  if (KNOWN_APP_SERVICES.has(service)) return 'app';
  if (mimeType) {
    if (/^image\//i.test(mimeType)) return 'image';
    if (/^audio\//i.test(mimeType)) return 'audio';
    if (/^video\//i.test(mimeType)) return 'video';
    if (/^text\//i.test(mimeType) || /\b(json|xml|yaml|csv|markdown)\b/i.test(mimeType)) return 'text';
    if (BINARY_MIME_RE.test(mimeType)) return 'none';
  }
  if (KNOWN_IMAGE_SERVICES.has(service)) return 'image';
  if (KNOWN_AUDIO_SERVICES.has(service)) return 'audio';
  if (KNOWN_VIDEO_SERVICES.has(service)) return 'video';
  return 'text';
}

function buildResourceUrl(service: string, name: string, identifier: string) {
  return `/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

function buildQdnUrl(service: string, name: string, identifier: string): string {
  const id = identifier && identifier !== 'default' ? `/${identifier}` : '';
  return `qdn://${service}/${name}${id}`;
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

function guessFilename(resource: QdnResource, properties: ResourceProperties | null): string {
  if (properties?.filename) return properties.filename;
  if (/\.[a-zA-Z0-9]{2,6}$/.test(resource.identifier)) return resource.identifier;
  return `${resource.service}_${resource.name}_${resource.identifier}`;
}

function triggerBlobDownload(b64: string, filename: string) {
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(ts: number | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

type TextState =
  | { phase: 'loading' }
  | { phase: 'ready'; content: string }
  | { phase: 'error'; message: string };

function TextContent({ resource }: { resource: QdnResource }) {
  const c = useColors();
  const [state, setState] = useState<TextState>({ phase: 'loading' });

  useEffect(() => {
    setState({ phase: 'loading' });
    let cancelled = false;

    fetchResourceText(resource.service, resource.name, resource.identifier)
      .then(raw => {
        if (cancelled) return;
        let content = raw;
        const isJson = ['JSON', 'METADATA'].includes(resource.service);
        if (isJson) {
          try { content = JSON.stringify(JSON.parse(raw), null, 2); } catch {}
        }
        setState({ phase: 'ready', content });
      })
      .catch(e => {
        if (cancelled) return;
        setState({ phase: 'error', message: e instanceof Error ? e.message : 'Failed to load content.' });
      });

    return () => { cancelled = true; };
  }, [resource.service, resource.name, resource.identifier]);

  if (state.phase === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={20} sx={{ color: c.accent }} />
      </Box>
    );
  }

  if (state.phase === 'error') {
    return (
      <Typography sx={{ fontSize: '0.75rem', color: c.error, mt: 1.5 }}>
        {state.message}
      </Typography>
    );
  }

  return (
    <Box
      component="pre"
      sx={{
        p: 2,
        bgcolor: c.borderLight,
        borderRadius: `${tokens.shape.radius}px`,
        fontSize: '0.72rem',
        fontFamily: 'monospace',
        color: c.textPrimary,
        overflow: 'auto',
        maxHeight: 380,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        m: 0,
      }}
    >
      {state.content}
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, minWidth: 88, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.72rem', color: c.textPrimary, wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}

function CopyLinkButton({ qdnUrl }: { qdnUrl: string }) {
  const c = useColors();
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const id = window.setTimeout(() => setState('idle'), 1_600);
    return () => window.clearTimeout(id);
  }, [state]);

  const label = state === 'copied' ? 'Copied!' : state === 'error' ? 'Failed' : 'Copy link';

  return (
    <Tooltip title={qdnUrl}>
      <Button
        size="small"
        startIcon={state === 'copied' ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
        onClick={async () => {
          const ok = await copyText(qdnUrl);
          setState(ok ? 'copied' : 'error');
        }}
        sx={{
          color: state === 'copied' ? c.accent : c.textSecondary,
          borderRadius: '50px', fontSize: '0.75rem',
          '&:hover': { bgcolor: c.borderLight },
        }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

function DownloadButton({
  resource,
  properties,
}: {
  resource: QdnResource;
  properties: ResourceProperties | null;
}) {
  const c = useColors();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    if (state !== 'error') return;
    const id = window.setTimeout(() => setState('idle'), 2_000);
    return () => window.clearTimeout(id);
  }, [state]);

  return (
    <Button
      size="small"
      disabled={state === 'loading'}
      startIcon={
        state === 'loading'
          ? <CircularProgress size={14} sx={{ color: c.textSecondary }} />
          : state === 'error'
            ? <ErrorOutlineIcon fontSize="small" />
            : <DownloadIcon fontSize="small" />
      }
      onClick={async () => {
        setState('loading');
        try {
          const b64 = await fetchResourceAsBase64(resource.service, resource.name, resource.identifier);
          triggerBlobDownload(b64, guessFilename(resource, properties));
          setState('idle');
        } catch {
          setState('error');
        }
      }}
      sx={{
        color: state === 'error' ? c.error : c.textSecondary,
        borderRadius: '50px', fontSize: '0.75rem',
        '&:hover': { bgcolor: c.borderLight },
        opacity: state === 'loading' ? 0.5 : 1,
      }}
    >
      {state === 'loading' ? 'Downloading…' : state === 'error' ? 'Failed' : 'Download'}
    </Button>
  );
}

// ─── Block / Follow action buttons ────────────────────────────────────────────

type ActionState = 'idle' | 'busy' | 'done' | 'error';

function BlockFollowButtons({ resource }: { resource: QdnResource }) {
  const c = useColors();
  const { block, unblock, follow, unfollow, isBlocked, isFollowed } = useQdnLists();
  const patterns = resourcePatterns(resource.service, resource.name, resource.identifier);

  const [followAnchor, setFollowAnchor] = useState<null | HTMLElement>(null);
  const [blockAnchor,  setBlockAnchor]  = useState<null | HTMLElement>(null);
  const [actionState,  setActionState]  = useState<ActionState>('idle');
  const [lastLabel,    setLastLabel]    = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(label: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLastLabel(label);
    setActionState('done');
    timerRef.current = setTimeout(() => setActionState('idle'), 2000);
  }

  async function doAction(fn: () => Promise<void>, label: string) {
    setFollowAnchor(null);
    setBlockAnchor(null);
    setActionState('busy');
    try {
      await fn();
      flash(label);
    } catch {
      setActionState('error');
      timerRef.current = setTimeout(() => setActionState('idle'), 2000);
    }
  }

  const exactBlocked  = isBlocked(patterns.exact);
  const exactFollowed = isFollowed(patterns.exact);

  const btnSx = (active: boolean, danger = false) => ({
    color: active
      ? (danger ? c.error : c.accent)
      : c.textSecondary,
    borderRadius: '50px',
    fontSize: '0.72rem',
    px: 1.5,
    '&:hover': { bgcolor: c.borderLight },
    transition: '0.12s ease',
  });

  const menuSx = {
    '& .MuiPaper-root': {
      bgcolor: c.surface,
      border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
      borderRadius: `${tokens.shape.radius}px`,
      minWidth: 220,
    },
  };

  const menuItemSx = {
    fontSize: '0.78rem',
    color: c.textPrimary,
    '&:hover': { bgcolor: c.borderLight },
    display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 0,
    py: 1,
  };

  if (actionState === 'busy') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <CircularProgress size={12} sx={{ color: c.accent }} />
        <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary }}>Saving…</Typography>
      </Box>
    );
  }

  if (actionState === 'done') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <CheckIcon sx={{ fontSize: '0.9rem', color: c.accent }} />
        <Typography sx={{ fontSize: '0.72rem', color: c.accent }}>{lastLabel}</Typography>
      </Box>
    );
  }

  if (actionState === 'error') {
    return (
      <Typography sx={{ fontSize: '0.72rem', color: c.error }}>Action failed</Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {/* Follow button */}
      <Button
        size="small"
        startIcon={exactFollowed ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        onClick={e => setFollowAnchor(e.currentTarget)}
        sx={btnSx(exactFollowed)}
      >
        Follow
      </Button>
      <Menu anchorEl={followAnchor} open={!!followAnchor} onClose={() => setFollowAnchor(null)} sx={menuSx}>
        <MenuItem
          onClick={() => doAction(
            exactFollowed ? () => unfollow(patterns.exact) : () => follow(patterns.exact),
            exactFollowed ? 'Unfollowed' : 'Following this resource',
          )}
          sx={menuItemSx}
        >
          <Box sx={{ fontWeight: tokens.typography.weightBold, color: exactFollowed ? c.accent : c.textPrimary }}>
            {exactFollowed ? '✓ ' : ''}{resource.service}/{resource.name}/{resource.identifier}
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary }}>this exact resource</Box>
        </MenuItem>

        <MenuItem
          onClick={() => doAction(
            isFollowed(patterns.byName) ? () => unfollow(patterns.byName) : () => follow(patterns.byName),
            isFollowed(patterns.byName) ? 'Unfollowed' : `Following all by ${resource.name}`,
          )}
          sx={menuItemSx}
        >
          <Box sx={{ fontWeight: tokens.typography.weightBold, color: isFollowed(patterns.byName) ? c.accent : c.textPrimary }}>
            {isFollowed(patterns.byName) ? '✓ ' : ''}*/{ resource.name}
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary }}>all content by {resource.name}</Box>
        </MenuItem>
      </Menu>

      {/* Block button */}
      <Button
        size="small"
        startIcon={<BlockIcon fontSize="small" />}
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        onClick={e => setBlockAnchor(e.currentTarget)}
        sx={btnSx(exactBlocked, true)}
      >
        Block
      </Button>
      <Menu anchorEl={blockAnchor} open={!!blockAnchor} onClose={() => setBlockAnchor(null)} sx={menuSx}>
        <MenuItem
          onClick={() => doAction(
            exactBlocked ? () => unblock(patterns.exact) : () => block(patterns.exact),
            exactBlocked ? 'Unblocked' : 'Blocked this resource',
          )}
          sx={menuItemSx}
        >
          <Box sx={{ fontWeight: tokens.typography.weightBold, color: exactBlocked ? c.error : c.textPrimary }}>
            {exactBlocked ? '✓ ' : ''}{resource.service}/{resource.name}/{resource.identifier}
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary }}>this exact resource</Box>
        </MenuItem>

        <MenuItem
          onClick={() => doAction(
            isBlocked(patterns.byName) ? () => unblock(patterns.byName) : () => block(patterns.byName),
            isBlocked(patterns.byName) ? 'Unblocked' : `Blocked all by ${resource.name}`,
          )}
          sx={menuItemSx}
        >
          <Box sx={{ fontWeight: tokens.typography.weightBold, color: isBlocked(patterns.byName) ? c.error : c.textPrimary }}>
            {isBlocked(patterns.byName) ? '✓ ' : ''}*/{resource.name}
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary }}>all content by {resource.name}</Box>
        </MenuItem>

        <Divider sx={{ borderColor: c.borderLight, my: 0.5 }} />

        <MenuItem
          onClick={() => doAction(
            isBlocked(patterns.byService) ? () => unblock(patterns.byService) : () => block(patterns.byService),
            isBlocked(patterns.byService) ? 'Unblocked' : `Blocked all ${resource.service}`,
          )}
          sx={menuItemSx}
        >
          <Box sx={{ fontWeight: tokens.typography.weightBold, color: isBlocked(patterns.byService) ? c.error : c.textPrimary }}>
            {isBlocked(patterns.byService) ? '✓ ' : ''}{resource.service}
          </Box>
          <Box sx={{ fontSize: '0.67rem', color: c.textSecondary }}>
            {patternLabel(patterns.byService)}
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

// ─── Resource viewer dialog ────────────────────────────────────────────────────

export function ResourceViewerDialog({
  resource,
  onClose,
}: {
  resource: QdnResource;
  onClose: () => void;
}) {
  const c = useColors();
  const [properties, setProperties] = useState<ResourceProperties | null>(null);
  const [propsLoading, setPropsLoading] = useState(true);

  useEffect(() => {
    setProperties(null);
    setPropsLoading(true);
    fetchResourceProperties(resource.service, resource.name, resource.identifier).then(p => {
      setProperties(p);
      setPropsLoading(false);
    });
  }, [resource.service, resource.name, resource.identifier]);

  const viewerKind = resolveViewerKind(resource.service, properties?.mimeType ?? undefined);
  const resourceUrl = buildResourceUrl(resource.service, resource.name, resource.identifier);
  const qdnUrl = buildQdnUrl(resource.service, resource.name, resource.identifier);
  const displaySize = properties?.size ?? resource.size;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: c.surface,
          border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          borderRadius: 0,
        },
      }}
    >
      <DialogTitle
        sx={{
          px: 3, py: 2,
          borderBottom: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}
      >
        <Box
          sx={{
            fontSize: '0.6rem', fontWeight: tokens.typography.weightBold,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            bgcolor: c.borderLight, color: c.textSecondary,
            px: 1, py: 0.25, borderRadius: '4px', flexShrink: 0,
          }}
        >
          {resource.service}
        </Box>
        <Typography
          sx={{
            fontSize: '0.9rem', fontWeight: tokens.typography.weightBold,
            color: c.textPrimary, fontFamily: 'monospace', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {resource.identifier}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ color: c.textSecondary, '&:hover': { color: c.textPrimary } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {propsLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={20} sx={{ color: c.accent }} />
          </Box>
        )}

        {!propsLoading && viewerKind === 'app' && (
          <Box
            sx={{
              bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`,
              p: 4, textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary, mb: 2.5 }}>
              {resource.service === 'WEBSITE' ? 'Websites' : 'Apps'} can't be previewed inline.
            </Typography>
            <Button
              variant="contained"
              disableElevation
              startIcon={<OpenInNewIcon fontSize="small" />}
              onClick={() => void openInNewTab(qdnUrl)}
              sx={{
                bgcolor: c.accent, color: c.accentText, borderRadius: '50px',
                '&:hover': { bgcolor: c.accentHover },
              }}
            >
              Open in Qortium
            </Button>
          </Box>
        )}

        {!propsLoading && viewerKind === 'image' && (
          <Box
            sx={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`,
              overflow: 'hidden', minHeight: 100,
            }}
          >
            <Box
              component="img"
              src={resourceUrl}
              alt={resource.identifier}
              sx={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
            />
          </Box>
        )}

        {!propsLoading && viewerKind === 'audio' && (
          <Box sx={{ bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`, p: 2 }}>
            <Box component="audio" controls src={resourceUrl} sx={{ width: '100%', display: 'block' }} />
          </Box>
        )}

        {!propsLoading && viewerKind === 'video' && (
          <Box sx={{ bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`, overflow: 'hidden' }}>
            <Box
              component="video"
              controls
              preload="metadata"
              src={resourceUrl}
              sx={{ width: '100%', maxHeight: 380, display: 'block' }}
            />
          </Box>
        )}

        {!propsLoading && viewerKind === 'text' && (
          <TextContent resource={resource} />
        )}

        {!propsLoading && viewerKind === 'none' && (
          <Box sx={{ bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`, p: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary }}>
              No preview available for this file type
              {properties?.mimeType ? ` (${properties.mimeType})` : ''}.
            </Typography>
          </Box>
        )}

        {/* All details */}
        <Box
          sx={{
            display: 'flex', flexDirection: 'column', gap: 0.75,
            pt: 2, borderTop: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          }}
        >
          <DetailRow label="QDN link" value={qdnUrl} />
          <DetailRow label="Name" value={resource.name} />
          <DetailRow label="Identifier" value={resource.identifier} />
          {properties?.filename && <DetailRow label="Filename" value={properties.filename} />}
          {properties?.mimeType && <DetailRow label="Type" value={properties.mimeType} />}
          <DetailRow label="Size" value={formatBytes(displaySize)} />
          <DetailRow label="Published" value={formatDate(resource.created)} />
          {resource.updated && resource.updated !== resource.created && (
            <DetailRow label="Updated" value={formatDate(resource.updated)} />
          )}
          {resource.title && <DetailRow label="Title" value={resource.title} />}
          {resource.description && <DetailRow label="Description" value={resource.description} />}
          {resource.tags && resource.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, minWidth: 88, flexShrink: 0, pt: 0.25 }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {resource.tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      fontSize: '0.6rem', fontWeight: tokens.typography.weightBold,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      bgcolor: c.borderLight, color: c.textSecondary, borderRadius: '4px',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

      </DialogContent>

      <DialogActions
        sx={{
          px: 3, pb: 3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          flexWrap: 'wrap', gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <CopyLinkButton qdnUrl={qdnUrl} />
          {viewerKind !== 'app' && (
            <DownloadButton resource={resource} properties={properties} />
          )}
          {viewerKind === 'app' && (
            <Button
              size="small"
              startIcon={<OpenInNewIcon fontSize="small" />}
              onClick={() => void openInNewTab(qdnUrl)}
              sx={{ color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { bgcolor: c.borderLight } }}
            >
              Open in Qortium
            </Button>
          )}

          <Box sx={{ width: '1px', height: 20, bgcolor: c.borderLight, mx: 0.5, alignSelf: 'center' }} />

          <BlockFollowButtons resource={resource} />
        </Box>

        <Button
          onClick={onClose}
          sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
