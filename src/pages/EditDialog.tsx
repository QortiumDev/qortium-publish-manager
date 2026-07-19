import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField,
  CircularProgress, Chip,
  Dialog, DialogTitle, DialogContent, IconButton,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { publishResource, publishResourceBase64, selectPublishSource, ensureAccountUnlocked } from '../api/qortal';
import type { PublishSource, QdnResource } from '../types';

function parseTags(raw: string): string[] {
  return raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function stripDataUrlPrefix(s: string): string {
  const m = s.match(/^data:[^;]+;base64,(.+)$/s);
  return m ? m[1] : s;
}

export function EditDialog({
  open,
  resource,
  onClose,
  onSuccess,
}: {
  open: boolean;
  resource: QdnResource | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const c = useColors();

  const [mode, setMode] = useState<'file' | 'base64'>('file');
  const [source, setSource] = useState<PublishSource | null>(null);
  const [base64Input, setBase64Input] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resource) return;
    setTitle(resource.title ?? '');
    setDescription(resource.description ?? '');
    setTagsInput((resource.tags ?? []).join(', '));
    setSource(null);
    setBase64Input('');
    setMode('file');
    setSuccess(false);
    setError(null);
  }, [open, resource]);

  const sourceName = source?.fileName ?? null;
  const sourceSize = source?.size ?? null;

  async function handlePickFile() {
    try {
      const result = await selectPublishSource();
      if (result) setSource(result);
    } catch {
      setError('File selection is not available on this host.');
    }
  }

  async function handleSave() {
    if (!resource) return;
    setPublishing(true);
    setError(null);
    try {
      if (!await ensureAccountUnlocked()) return;

      const tags = parseTags(tagsInput);
      const meta = {
        title:       title.trim()       || undefined,
        description: description.trim() || undefined,
        tags:        tags.length ? tags : undefined,
      };

      if (mode === 'file') {
        if (!source) return;
        await publishResource({ service: resource.service, name: resource.name, source, identifier: resource.identifier, ...meta });
      } else {
        const raw = stripDataUrlPrefix(base64Input.trim().replace(/\s/g, ''));
        if (!raw) return;
        await publishResourceBase64({ service: resource.service, name: resource.name, data64: raw, identifier: resource.identifier, ...meta });
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setPublishing(false);
    }
  }

  const canSave = !publishing && (
    mode === 'file' ? !!source : base64Input.trim().length > 0
  );

  const tags = parseTags(tagsInput);

  function renderContent() {
    if (!resource) return null;

    if (success) {
      return (
        <Box sx={{ textAlign: 'center', py: 2, mt: 3 }}>
          <CheckCircleIcon sx={{ fontSize: '3rem', color: c.success, mb: 2 }} />
          <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.25rem', color: c.textPrimary, mb: 1 }}>
            Updated
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary, mb: 3 }}>
            {resource.name} / {resource.service} / {resource.identifier}
          </Typography>
          <Button
            onClick={onClose}
            variant="contained"
            disableElevation
            sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', '&:hover': { bgcolor: c.accentHover } }}
          >
            Done
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 3 }}>

        <Box sx={{ bgcolor: c.borderLight, borderRadius: `${tokens.shape.radius}px`, px: 2, py: 1.25 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.textSecondary, mb: 0.5 }}>
            Overwriting
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', fontFamily: 'monospace', color: c.textPrimary }}>
            {resource.service} / {resource.name} / {resource.identifier}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {(['file', 'base64'] as const).map(m => (
            <Button
              key={m}
              size="small"
              onClick={() => setMode(m)}
              sx={{
                borderRadius: '50px',
                fontSize: '0.75rem',
                px: 2,
                bgcolor: mode === m ? c.accent : 'transparent',
                color: mode === m ? c.accentText : c.textSecondary,
                border: `1.5px solid ${mode === m ? c.accent : c.borderLight}`,
                '&:hover': { bgcolor: mode === m ? c.accentHover : c.borderLight },
              }}
            >
              {m === 'file' ? 'Upload file' : 'Paste base64'}
            </Button>
          ))}
        </Box>

        {mode === 'file' ? (
          <>
            <Box
              onClick={handlePickFile}
              sx={{
                border: `${tokens.shape.borderWidth} dashed ${c.borderLight}`,
                borderRadius: `${tokens.shape.radius}px`,
                bgcolor: c.surface,
                px: 3, py: 4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                cursor: 'pointer', transition: '0.15s ease',
                '&:hover': { borderColor: c.accent, bgcolor: `${c.accent}08` },
              }}
            >
              <CloudUploadIcon sx={{ fontSize: '2rem', color: source ? c.accent : c.textSecondary }} />
              {sourceName ? (
                <>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
                    {sourceName}
                  </Typography>
                  {sourceSize !== null && (
                    <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary }}>
                      {formatBytes(sourceSize)}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
                  Click to choose a replacement file
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <TextField
            label="Base64 data"
            value={base64Input}
            onChange={e => setBase64Input(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={4}
            maxRows={8}
            placeholder="Paste raw base64 or a data: URL"
            helperText="Whitespace and data: URL prefixes are stripped automatically."
            slotProps={{
              inputLabel: { sx: { fontSize: '0.8rem', color: c.textSecondary } },
              htmlInput:  { sx: { fontSize: '0.75rem', color: c.textPrimary, fontFamily: 'monospace' } },
              formHelperText: { sx: { fontSize: '0.7rem', color: c.textSecondary } },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: c.surface,
                '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
                '&:hover fieldset': { borderColor: c.accent },
                '&.Mui-focused fieldset': { borderColor: c.accent },
              },
            }}
          />
        )}

        <TextField
          label="Title"
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, 80))}
          size="small"
          fullWidth
          helperText={`${title.length}/80`}
          slotProps={{
            inputLabel: { sx: { fontSize: '0.8rem', color: c.textSecondary } },
            htmlInput:  { sx: { fontSize: '0.8rem', color: c.textPrimary } },
            formHelperText: { sx: { fontSize: '0.7rem', color: c.textSecondary } },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: c.surface,
              '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
              '&:hover fieldset': { borderColor: c.accent },
              '&.Mui-focused fieldset': { borderColor: c.accent },
            },
          }}
        />

        <TextField
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, 240))}
          size="small"
          fullWidth
          multiline
          minRows={2}
          helperText={`${description.length}/240`}
          slotProps={{
            inputLabel: { sx: { fontSize: '0.8rem', color: c.textSecondary } },
            htmlInput:  { sx: { fontSize: '0.8rem', color: c.textPrimary } },
            formHelperText: { sx: { fontSize: '0.7rem', color: c.textSecondary } },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: c.surface,
              '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
              '&:hover fieldset': { borderColor: c.accent },
              '&.Mui-focused fieldset': { borderColor: c.accent },
            },
          }}
        />

        <Box>
          <TextField
            label="Tags"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            size="small"
            fullWidth
            placeholder="tag1, tag2, tag3"
            helperText="Comma-separated, up to 5 tags, 20 chars each."
            slotProps={{
              inputLabel: { sx: { fontSize: '0.8rem', color: c.textSecondary } },
              htmlInput:  { sx: { fontSize: '0.8rem', color: c.textPrimary } },
              formHelperText: { sx: { fontSize: '0.7rem', color: c.textSecondary } },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: c.surface,
                '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
                '&:hover fieldset': { borderColor: c.accent },
                '&.Mui-focused fieldset': { borderColor: c.accent },
              },
            }}
          />
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {tags.map(t => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  sx={{
                    fontSize: '0.65rem', fontWeight: tokens.typography.weightBold,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    bgcolor: c.borderLight, color: c.textSecondary, borderRadius: '4px',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {error && (
          <Typography sx={{ fontSize: '0.8rem', color: c.error }}>
            {error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
          <Button
            onClick={onClose}
            disabled={publishing}
            sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={!canSave}
            startIcon={publishing ? <CircularProgress size={16} sx={{ color: c.accentText }} /> : <CloudUploadIcon />}
            sx={{
              bgcolor: c.accent, color: c.accentText, borderRadius: '50px',
              '&:hover': { bgcolor: c.accentHover },
              opacity: canSave ? 1 : 0.35,
            }}
          >
            {publishing ? 'Saving…' : 'Save'}
          </Button>
        </Box>

      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => !publishing && onClose()}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: c.surface,
          border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          borderRadius: `${tokens.shape.radius}px`,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 0, display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.1rem', color: c.textPrimary, flex: 1, letterSpacing: '-0.01em' }}>
          Edit resource
        </Typography>
        <IconButton
          onClick={onClose}
          disabled={publishing}
          size="small"
          sx={{ color: c.textSecondary, '&:hover': { color: c.textPrimary, bgcolor: c.borderLight }, borderRadius: `${tokens.shape.radius}px` }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 3, pt: 0 }}>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
