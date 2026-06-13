import { useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, MenuItem,
  CircularProgress, Chip, FormControlLabel, Checkbox,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { accountAtom } from '../state/atoms';
import { publishResource } from '../api/qortal';
import { SERVICE_TYPES } from '../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function parseTags(raw: string): string[] {
  return raw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
}

export function PublishPage() {
  const c = useColors();
  const account = useAtomValue(accountAtom);
  const navigate = useNavigate();

  const [service, setService] = useState('ARBITRARY_DATA');
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isMultiFileZip, setIsMultiFileZip] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedService = SERVICE_TYPES.find(s => s.value === service);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  async function handlePublish() {
    if (!file) return;
    setPublishing(true);
    setError(null);
    try {
      await publishResource({
        service,
        file,
        identifier: identifier.trim() || 'default',
        title:       title.trim()       || undefined,
        description: description.trim() || undefined,
        tags:        parseTags(tagsInput).length ? parseTags(tagsInput) : undefined,
        isMultiFileZip,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  function handleReset() {
    setFile(null);
    setIdentifier('');
    setTitle('');
    setDescription('');
    setTagsInput('');
    setIsMultiFileZip(false);
    setSuccess(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const tags = parseTags(tagsInput);
  const canPublish = !!file && !publishing;

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

  if (success) {
    return (
      <Box sx={{ pt: `${tokens.spacing.topBarHeight + 48}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: '3rem', color: c.success, mb: 2 }} />
        <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.25rem', color: c.textPrimary, mb: 1 }}>
          Published
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: c.textSecondary, mb: 3 }}>
          {service} / {identifier.trim() || 'default'}
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
            onClick={() => navigate('/')}
            sx={{ color: c.textSecondary, borderRadius: '50px', '&:hover': { bgcolor: c.borderLight } }}
          >
            My publishes
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: `${tokens.spacing.topBarHeight + 24}px`, pb: 4, px: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>

      <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1.5rem', letterSpacing: '-0.02em', color: c.textPrimary, mb: 3 }}>
        Publish
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

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
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
          sx={{
            border: `${tokens.shape.borderWidth} dashed ${isDragOver ? c.accent : c.borderLight}`,
            borderRadius: `${tokens.shape.radius}px`,
            bgcolor: isDragOver ? `${c.accent}10` : c.surface,
            px: 3, py: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            cursor: 'pointer', transition: '0.15s ease',
            '&:hover': { borderColor: c.accent, bgcolor: `${c.accent}08` },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: '2rem', color: file ? c.accent : c.textSecondary }} />
          {file ? (
            <>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
                {file.name}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary }}>
                {formatBytes(file.size)}
              </Typography>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
                Drop a file here or click to browse
              </Typography>
            </>
          )}
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
        </Box>

        {file?.name.toLowerCase().endsWith('.zip') && (
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

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
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

      </Box>
    </Box>
  );
}
