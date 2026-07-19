import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, MenuItem,
  CircularProgress, Chip, FormControlLabel, Checkbox,
  Dialog, DialogTitle, DialogContent, IconButton,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CloseIcon from '@mui/icons-material/Close';
import { useAtom, useAtomValue } from 'jotai';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import {
  accountAtom,
  publishServiceAtom, publishSourceAtom, publishIdentifierAtom,
  publishTitleAtom, publishDescriptionAtom, publishTagsInputAtom,
  publishMultiFileZipAtom,
} from '../state/atoms';
import { publishResource, publishAvatar, publishAvatarFromQDN, selectPublishSource, getNamesByAddress, AVATAR_GIF_MAX_BYTES, ensureAccountUnlocked } from '../api/qortal';
import { SERVICE_TYPES } from '../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function parseTags(raw: string): string[] {
  return raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
}

const DEFAULT_AVATAR_NAME = '7R15M3G157U5';

function NameAvatarSection({ name }: { name: string }) {
  const c = useColors();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [cacheBust, setCacheBust] = useState(0);
  const [currentAvatarErr, setCurrentAvatarErr] = useState(false);
  const [defaultAvatarErr, setDefaultAvatarErr] = useState(false);

  const currentAvatarUrl = `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/avatar?cb=${cacheBust}`;
  const defaultAvatarUrl = `/arbitrary/THUMBNAIL/${DEFAULT_AVATAR_NAME}/avatar`;

  const resetImageErrors = useCallback(() => {
    setCurrentAvatarErr(false);
    setDefaultAvatarErr(false);
  }, []);

  useEffect(() => { resetImageErrors(); }, [name, cacheBust, resetImageErrors]);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.type === 'image/gif' && file.size > AVATAR_GIF_MAX_BYTES) {
      setErrorMsg('GIF too large — max ~3.5 MB.');
      return;
    }
    setErrorMsg('');
    setStatus('idle');
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handlePublish() {
    if (!pendingFile) return;
    setPublishing(true);
    setStatus('idle');
    try {
      await publishAvatar(name, pendingFile);
      setStatus('success');
      setPendingFile(null);
      setPreview(null);
      setCacheBust(v => v + 1);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to set avatar.');
      setStatus('error');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUseDefault() {
    setPublishing(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      await publishAvatarFromQDN(name, DEFAULT_AVATAR_NAME);
      setStatus('success');
      setCacheBust(v => v + 1);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to set avatar.');
      setStatus('error');
    } finally {
      setPublishing(false);
    }
  }

  function handleDiscard() {
    setPendingFile(null);
    setPreview(null);
    setStatus('idle');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <Box sx={{ mt: 4, pt: 4, borderTop: `${tokens.shape.borderWidth} solid ${c.borderLight}` }}>
      <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1rem', letterSpacing: '-0.01em', color: c.textPrimary, mb: 0.5 }}>
        Name avatar
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mb: 2.5 }}>
        Set an icon for <strong style={{ color: c.textPrimary }}>{name}</strong>. Appears in Profilium and anywhere names are displayed.
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box sx={{
          width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
          border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
          overflow: 'hidden', bgcolor: c.borderLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {preview ? (
            <Box component="img" src={preview} alt="preview" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : !currentAvatarErr ? (
            <Box component="img" src={currentAvatarUrl} alt="avatar" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setCurrentAvatarErr(true)} />
          ) : !defaultAvatarErr ? (
            <Box component="img" src={defaultAvatarUrl} alt="default avatar" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setDefaultAvatarErr(true)} />
          ) : (
            <AccountCircleIcon sx={{ fontSize: '2.5rem', color: c.textSecondary, opacity: 0.35 }} />
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: (status !== 'idle' || errorMsg) ? 1 : 0 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={publishing}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderColor: c.borderLight, color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { borderColor: c.accent, color: c.accent, bgcolor: 'transparent' } }}
            >
              {preview ? 'Choose different' : 'Choose image'}
            </Button>

            {!preview && (
              <Button
                size="small"
                variant="outlined"
                disabled={publishing}
                onClick={handleUseDefault}
                startIcon={publishing ? <CircularProgress size={12} sx={{ color: c.textSecondary }} /> : undefined}
                sx={{ borderColor: c.borderLight, color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { borderColor: c.accent, color: c.accent, bgcolor: 'transparent' }, opacity: publishing ? 0.5 : 1 }}
              >
                {publishing ? 'Setting…' : 'Use default'}
              </Button>
            )}

            {preview && !publishing && (
              <Button
                size="small"
                onClick={handleDiscard}
                sx={{ color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { bgcolor: c.borderLight } }}
              >
                Discard
              </Button>
            )}

            {preview && (
              <Button
                size="small"
                variant="contained"
                disableElevation
                disabled={publishing}
                onClick={handlePublish}
                startIcon={publishing ? <CircularProgress size={12} sx={{ color: c.accentText }} /> : undefined}
                sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { bgcolor: c.accentHover }, opacity: publishing ? 0.5 : 1 }}
              >
                {publishing ? 'Setting…' : 'Set avatar'}
              </Button>
            )}
          </Box>

          {status === 'success' && (
            <Typography sx={{ fontSize: '0.75rem', color: c.success }}>Avatar updated.</Typography>
          )}
          {(status === 'error' || errorMsg) && (
            <Typography sx={{ fontSize: '0.75rem', color: c.error }}>{errorMsg}</Typography>
          )}
          {!preview && status === 'idle' && !errorMsg && (
            <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, mt: 0.5 }}>
              Any image · GIF max ~3.5 MB · others resized to 800 px
            </Typography>
          )}
        </Box>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </Box>
  );
}

export function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const account = useAtomValue(accountAtom);

  const [service, setService] = useAtom(publishServiceAtom);
  const [selectedName, setSelectedName] = useState<string>('');
  const [ownedNames, setOwnedNames] = useState<string[]>([]);
  const [source, setSource] = useAtom(publishSourceAtom);
  const [identifier, setIdentifier] = useAtom(publishIdentifierAtom);
  const [title, setTitle] = useAtom(publishTitleAtom);
  const [description, setDescription] = useAtom(publishDescriptionAtom);
  const [tagsInput, setTagsInput] = useAtom(publishTagsInputAtom);
  const [isMultiFileZip, setIsMultiFileZip] = useAtom(publishMultiFileZipAtom);
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceName = source?.fileName ?? null;
  const sourceSize = source?.size ?? null;

  const handleReset = useCallback(() => {
    setSource(null);
    setIdentifier('');
    setTitle('');
    setDescription('');
    setTagsInput('');
    setIsMultiFileZip(false);
    setSuccess(false);
    setError(null);
  }, [setSource, setIdentifier, setTitle, setDescription, setTagsInput, setIsMultiFileZip]);

  // Draft fields deliberately survive closing the dialog; only a completed
  // publish left on the success screen is cleared away on reopen.
  useEffect(() => {
    if (open && success) handleReset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !account?.address) return;
    getNamesByAddress(account.address).then(names => {
      setOwnedNames(names);
      if (names.length > 0 && !names.includes(selectedName)) {
        setSelectedName(names[0]);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.address]);

  const selectedService = SERVICE_TYPES.find(s => s.value === service);

  async function handlePickFile() {
    try {
      const result = await selectPublishSource();
      if (result) setSource(result);
    } catch {
      setError('File selection is not available on this host.');
    }
  }

  async function handlePublish() {
    if (!source) return;
    setPublishing(true);
    setError(null);
    try {
      if (!await ensureAccountUnlocked()) return;
      await publishResource({
        service,
        name: selectedName,
        source,
        identifier: identifier.trim() || 'default',
        title:       title.trim()       || undefined,
        description: description.trim() || undefined,
        tags:        parseTags(tagsInput).length ? parseTags(tagsInput) : undefined,
        isMultiFileZip,
      });
      setSuccess(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(
        raw.includes('MISSING_INDEX_FILE')
          ? 'Validation failed: no index.html found at the ZIP root. WEBSITE publishing requires index.html directly at the top level of the ZIP - not inside a subfolder. Re-zip your site from inside the folder that contains index.html.'
          : raw || 'Publish failed.',
      );
    } finally {
      setPublishing(false);
    }
  }

  const tags = parseTags(tagsInput);
  const canPublish = !!source && !publishing && !!selectedName;
  const hasDraft = !!source || !!identifier || !!title || !!description || !!tagsInput || isMultiFileZip;

  function renderContent() {
    if (!account) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, mt: 3 }}>
          <CircularProgress size={24} sx={{ color: c.accent }} />
        </Box>
      );
    }

    if (!account.name) {
      return (
        <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary, textAlign: 'center', py: 2, mt: 3 }}>
          You need a registered name to publish QDN resources.
        </Typography>
      );
    }

    if (success) {
      return (
        <Box sx={{ textAlign: 'center', py: 2, mt: 3 }}>
          <CheckCircleIcon sx={{ fontSize: '3rem', color: c.success, mb: 2 }} />
          <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.25rem', color: c.textPrimary, mb: 1 }}>
            Published
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary, mb: 3 }}>
            {selectedName} / {service} / {identifier.trim() || 'default'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button
              onClick={handleReset}
              variant="contained"
              disableElevation
              sx={{ bgcolor: c.accent, color: c.accentText, borderRadius: '50px', '&:hover': { bgcolor: c.accentHover } }}
            >
              Publish another
            </Button>
            <Button
              onClick={onClose}
              sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
            >
              Done
            </Button>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 3 }}>

        <TextField
          select
          label="Publish as"
          value={selectedName}
          onChange={e => setSelectedName(e.target.value)}
          size="small"
          fullWidth
          disabled={ownedNames.length <= 1}
          slotProps={{
            inputLabel: { sx: { fontSize: '0.8rem', color: c.textSecondary } },
            htmlInput:  { sx: { fontSize: '0.8rem', color: c.textPrimary } },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: c.surface,
              '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
              '&:hover fieldset': { borderColor: ownedNames.length > 1 ? c.accent : c.borderLight },
              '&.Mui-focused fieldset': { borderColor: c.accent },
            },
          }}
        >
          {ownedNames.map(n => (
            <MenuItem key={n} value={n} sx={{ fontSize: '0.8rem' }}>{n}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Service type"
          value={service}
          onChange={e => setService(e.target.value)}
          size="small"
          fullWidth
          helperText={
            selectedService?.maxSize
              ? `Max size: ${selectedService.maxSize}${selectedService.note ? ` · ${selectedService.note}` : ''}`
              : selectedService?.note ?? ''
          }
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
        >
          {SERVICE_TYPES.map(s => (
            <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.8rem' }}>
              {s.label}
              {s.maxSize && (
                <Typography component="span" sx={{ fontSize: '0.65rem', color: c.textSecondary, ml: 1 }}>
                  {s.maxSize}
                </Typography>
              )}
            </MenuItem>
          ))}
        </TextField>

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
              Click to choose a file
            </Typography>
          )}
        </Box>

        {sourceName?.toLowerCase().endsWith('.zip') && (
          <FormControlLabel
            control={
              <Checkbox
                checked={isMultiFileZip}
                onChange={e => setIsMultiFileZip(e.target.checked)}
                size="small"
                sx={{ color: c.textSecondary, '&.Mui-checked': { color: c.accent } }}
              />
            }
            label={
              <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary }}>
                Multi-file ZIP (unpack on QDN)
              </Typography>
            }
          />
        )}

        <TextField
          label="Identifier"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          placeholder="default"
          size="small"
          fullWidth
          helperText={'Unique key for this resource under your name. Defaults to "default".'}
          slotProps={{
            inputLabel: { sx: { fontSize: '0.8rem', color: c.textSecondary } },
            htmlInput:  { sx: { fontSize: '0.8rem', color: c.textPrimary, fontFamily: 'monospace' } },
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
          {hasDraft && !publishing && (
            <Button
              onClick={handleReset}
              sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
            >
              Clear all
            </Button>
          )}
          <Button
            variant="contained"
            disableElevation
            onClick={handlePublish}
            disabled={!canPublish}
            startIcon={publishing ? <CircularProgress size={16} sx={{ color: c.accentText }} /> : <CloudUploadIcon />}
            sx={{
              bgcolor: c.accent, color: c.accentText, borderRadius: '50px',
              '&:hover': { bgcolor: c.accentHover },
              opacity: canPublish ? 1 : 0.35,
            }}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </Box>

        <NameAvatarSection name={selectedName || account.name} />

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
      <DialogTitle
        sx={{ px: 3, pt: 2.5, pb: 0, display: 'flex', alignItems: 'center' }}
      >
        <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.1rem', color: c.textPrimary, flex: 1, letterSpacing: '-0.01em' }}>
          Publish
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
