import { useState, useEffect, useMemo } from 'react';
import {
  Box, Button, Chip, CircularProgress, IconButton,
  MenuItem, Select, TextField, Tooltip, Typography, Tab, Tabs,
  FormControlLabel, Checkbox, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import BlockIcon from '@mui/icons-material/Block';
import PersonIcon from '@mui/icons-material/Person';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { getList, addToList, removeFromList } from '../api/qortal';
import { useQdnLists } from '../hooks/useQdnLists';
import {
  buildPattern, patternLabel, patternScope,
  type PatternScope,
} from '../lib/qdnPattern';
import { SERVICE_TYPES } from '../types';

// ─── Scope badge ─────────────────────────────────────────────────────────────

const SCOPE_LABEL: Record<PatternScope, string> = {
  broad:    'service',
  name:     'name',
  resource: 'exact',
};

function ScopeBadge({ scope }: { scope: PatternScope }) {
  const c = useColors();
  const colors: Record<PatternScope, string> = {
    broad:    c.textSecondary,
    name:     c.accent,
    resource: c.textPrimary,
  };
  return (
    <Box sx={{
      fontSize: '0.55rem', fontWeight: tokens.typography.weightBold,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      px: 0.75, py: 0.2, borderRadius: '4px',
      border: `1px solid ${colors[scope]}40`,
      color: colors[scope],
      flexShrink: 0, lineHeight: 1.5,
    }}>
      {SCOPE_LABEL[scope]}
    </Box>
  );
}

// ─── Pattern item row ─────────────────────────────────────────────────────────

function PatternItem({
  pattern,
  onRemove,
  accentColor,
}: {
  pattern: string;
  onRemove: () => Promise<void>;
  accentColor?: string;
}) {
  const c = useColors();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try { await onRemove(); } finally { setRemoving(false); }
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25,
      px: 1.5, py: 0.9,
      bgcolor: c.surface,
      border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
      borderRadius: `${tokens.shape.radius}px`,
    }}>
      <ScopeBadge scope={patternScope(pattern)} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontFamily: 'monospace', fontSize: '0.8rem',
          color: c.textPrimary, fontWeight: tokens.typography.weightBold,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {pattern}
        </Typography>
        <Typography sx={{ fontSize: '0.67rem', color: c.textSecondary }}>
          {patternLabel(pattern)}
        </Typography>
      </Box>
      <Tooltip title="Remove">
        <span>
          <IconButton
            size="small"
            onClick={handleRemove}
            disabled={removing}
            sx={{ color: c.textSecondary, '&:hover': { color: accentColor ?? c.error }, transition: '0.12s ease' }}
          >
            {removing
              ? <CircularProgress size={12} sx={{ color: c.textSecondary }} />
              : <CloseIcon sx={{ fontSize: '0.9rem' }} />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

// ─── Person follow item row ───────────────────────────────────────────────────

function PersonFollowItem({ name, onRemove }: { name: string; onRemove: () => Promise<void> }) {
  const c = useColors();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try { await onRemove(); } finally { setRemoving(false); }
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25,
      px: 1.5, py: 0.9,
      bgcolor: c.surface,
      border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
      borderRadius: `${tokens.shape.radius}px`,
    }}>
      <PersonIcon sx={{ fontSize: '0.95rem', color: c.accent, flexShrink: 0 }} />
      <Typography sx={{ flex: 1, fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </Typography>
      <Box sx={{
        fontSize: '0.55rem', fontWeight: tokens.typography.weightBold,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        px: 0.75, py: 0.2, borderRadius: '4px',
        border: `1px solid ${c.accent}40`, color: c.accent,
        flexShrink: 0, lineHeight: 1.5,
      }}>
        creator
      </Box>
      <Tooltip title="Unfollow">
        <span>
          <IconButton
            size="small"
            onClick={handleRemove}
            disabled={removing}
            sx={{ color: c.textSecondary, '&:hover': { color: c.error }, transition: '0.12s ease' }}
          >
            {removing
              ? <CircularProgress size={12} sx={{ color: c.textSecondary }} />
              : <CloseIcon sx={{ fontSize: '0.9rem' }} />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

// ─── Person block item row ────────────────────────────────────────────────────

interface PersonBlockEntry {
  value: string;
  isAddress: boolean;
  blockedContent: boolean;
  blockedChat: boolean;
}

function PersonBlockItem({
  entry,
  onRemoveBadge,
}: {
  entry: PersonBlockEntry;
  onRemoveBadge: (which: 'content' | 'chat' | 'all') => Promise<void>;
}) {
  const c = useColors();
  const [removingContent, setRemovingContent] = useState(false);
  const [removingChat, setRemovingChat] = useState(false);

  const hasBoth = entry.blockedContent && entry.blockedChat;

  async function handleContent() {
    setRemovingContent(true);
    try { await onRemoveBadge(hasBoth ? 'content' : 'all'); } finally { setRemovingContent(false); }
  }

  async function handleChat() {
    setRemovingChat(true);
    try { await onRemoveBadge(hasBoth ? 'chat' : 'all'); } finally { setRemovingChat(false); }
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25,
      px: 1.5, py: 0.9,
      bgcolor: c.surface,
      border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
      borderRadius: `${tokens.shape.radius}px`,
    }}>
      <PersonIcon sx={{ fontSize: '0.95rem', color: c.textSecondary, flexShrink: 0 }} />
      <Typography sx={{
        flex: 1, fontSize: entry.isAddress ? '0.72rem' : '0.85rem',
        fontFamily: entry.isAddress ? 'monospace' : undefined,
        fontWeight: tokens.typography.weightBold,
        color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {entry.value}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        {entry.blockedContent && (
          <Tooltip title={hasBoth ? 'Remove content block' : 'Remove block'}>
            <Chip
              label={removingContent ? '' : 'content'}
              size="small"
              onDelete={handleContent}
              deleteIcon={removingContent ? <CircularProgress size={10} sx={{ color: `${c.error}99` }} /> : undefined}
              sx={{
                fontSize: '0.6rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.06em',
                textTransform: 'uppercase', bgcolor: `${c.error}15`, color: c.error,
                border: `1px solid ${c.error}35`,
                '& .MuiChip-deleteIcon': { color: `${c.error}99`, '&:hover': { color: c.error } },
              }}
            />
          </Tooltip>
        )}
        {entry.blockedChat && (
          <Tooltip title={hasBoth ? 'Remove chat block' : 'Remove block'}>
            <Chip
              label={removingChat ? '' : 'chat'}
              size="small"
              onDelete={handleChat}
              deleteIcon={removingChat ? <CircularProgress size={10} sx={{ color: `${c.textSecondary}99` }} /> : undefined}
              sx={{
                fontSize: '0.6rem', fontWeight: tokens.typography.weightBold, letterSpacing: '0.06em',
                textTransform: 'uppercase', bgcolor: c.borderLight, color: c.textSecondary,
                border: `1px solid ${c.borderLight}`,
                '& .MuiChip-deleteIcon': { color: c.textSecondary, '&:hover': { color: c.error } },
              }}
            />
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

// ─── Content pattern wizard form ──────────────────────────────────────────────

function ContentPatternWizard({
  mode,
  existing,
  onAdd,
  onBack,
}: {
  mode: 'follow' | 'block';
  existing: string[];
  onAdd: (pattern: string) => Promise<void>;
  onBack: () => void;
}) {
  const c = useColors();
  const accent = mode === 'block' ? c.error : c.accent;

  const [service,  setService]  = useState('*');
  const [nameWild, setNameWild] = useState(true);
  const [name,     setName]     = useState('');
  const [idWild,   setIdWild]   = useState(true);
  const [id,       setId]       = useState('');
  const [adding,   setAdding]   = useState(false);
  const [error,    setError]    = useState('');

  const effectiveName = nameWild ? '' : name;
  const effectiveId   = idWild   ? '' : id;
  const pattern       = buildPattern(service, effectiveName, effectiveId);
  const label         = patternLabel(pattern);
  const isDup         = existing.includes(pattern);
  const isAllWild     = pattern === '*';
  const canAdd        = !isDup && !isAllWild && !adding;

  async function handleAdd() {
    if (!canAdd) return;
    setAdding(true);
    setError('');
    try {
      await onAdd(pattern);
      setName(''); setId(''); setNameWild(true); setIdWild(true); setService('*');
    } catch {
      setError('Failed to add. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      fontSize: '0.82rem', bgcolor: c.surface,
      '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
      '&:hover fieldset': { borderColor: accent },
      '&.Mui-focused fieldset': { borderColor: accent },
    },
    '& input': { color: c.textPrimary },
  };

  const wildChipSx = (active: boolean) => ({
    fontSize: '0.72rem', cursor: 'pointer', px: 0.5, alignSelf: 'center',
    bgcolor: active ? accent : 'transparent',
    color: active ? '#fff' : c.textSecondary,
    border: `1.5px solid ${active ? accent : c.borderLight}`,
    '&:hover': { bgcolor: active ? accent : c.borderLight },
    transition: '0.12s ease',
  });

  const labelSx = {
    fontSize: '0.68rem', fontWeight: tokens.typography.weightBold,
    color: c.textSecondary, mb: 0.5,
    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Content type */}
      <Box>
        <Typography sx={labelSx}>Content type</Typography>
        <Select
          size="small"
          value={service}
          onChange={e => setService(e.target.value)}
          fullWidth
          sx={{
            fontSize: '0.82rem', color: c.textPrimary,
            '& .MuiSelect-select': { py: '7px' },
            '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
            '&:hover fieldset': { borderColor: accent },
            '&.Mui-focused fieldset': { borderColor: accent },
            bgcolor: c.surface,
          }}
          MenuProps={{ PaperProps: { sx: { bgcolor: c.surface, color: c.textPrimary } } }}
        >
          <MenuItem value="*" sx={{ fontSize: '0.82rem', fontStyle: 'italic', color: c.textSecondary }}>
            Any type
          </MenuItem>
          {SERVICE_TYPES.map(st => (
            <MenuItem key={st.value} value={st.value} sx={{ fontSize: '0.82rem' }}>
              {st.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Creator */}
      <Box>
        <Typography sx={labelSx}>Creator</Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            size="small"
            value={nameWild ? '' : name}
            onChange={e => setName(e.target.value)}
            disabled={nameWild}
            placeholder={nameWild ? '—' : 'Name'}
            sx={{ flex: 1, ...fieldSx }}
          />
          <Chip
            label="Anyone"
            size="small"
            onClick={() => setNameWild(w => !w)}
            sx={wildChipSx(nameWild)}
          />
        </Box>
      </Box>

      {/* Content ID */}
      <Box>
        <Typography sx={labelSx}>Content ID</Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            size="small"
            value={idWild ? '' : id}
            onChange={e => setId(e.target.value)}
            disabled={idWild}
            placeholder={idWild ? '—' : 'Identifier'}
            sx={{ flex: 1, ...fieldSx, '& input': { fontFamily: 'monospace', color: c.textPrimary } }}
          />
          <Chip
            label="Any"
            size="small"
            onClick={() => setIdWild(w => !w)}
            sx={wildChipSx(idWild)}
          />
        </Box>
      </Box>

      {/* Preview */}
      <Box sx={{
        px: 1.5, py: 1,
        bgcolor: `${accent}0d`, borderRadius: `${tokens.shape.radius}px`,
        border: `1px solid ${accent}25`,
      }}>
        <Typography sx={{ fontSize: '0.68rem', color: c.textSecondary, mb: 0.25 }}>Result</Typography>
        <Typography sx={{ fontSize: '0.88rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
          {mode === 'follow' ? 'Follow' : 'Block'} {label.toLowerCase()}
        </Typography>
        {isDup     && <Typography sx={{ fontSize: '0.7rem', color: c.error, mt: 0.25 }}>Already in list.</Typography>}
        {isAllWild && !isDup && <Typography sx={{ fontSize: '0.7rem', color: c.error, mt: 0.25 }}>Pattern must be more specific than all resources.</Typography>}
      </Box>

      {error && <Typography sx={{ fontSize: '0.75rem', color: c.error }}>{error}</Typography>}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={onBack}
          startIcon={<ArrowBackIcon sx={{ fontSize: '0.85rem' }} />}
          sx={{ color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { bgcolor: c.borderLight } }}
        >
          Back
        </Button>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={handleAdd}
          disabled={!canAdd}
          sx={{
            bgcolor: accent, color: '#fff', borderRadius: '50px', fontSize: '0.75rem',
            '&:hover': { filter: 'brightness(0.9)' },
            '&.Mui-disabled': { opacity: 0.35, bgcolor: accent, color: '#fff' },
          }}
        >
          {adding
            ? <CircularProgress size={12} sx={{ color: '#fff' }} />
            : (mode === 'follow' ? 'Follow' : 'Block')}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Person follow wizard form ─────────────────────────────────────────────────

function PersonFollowWizard({
  existing,
  onAdd,
  onBack,
}: {
  existing: string[];
  onAdd: (name: string) => Promise<void>;
  onBack: () => void;
}) {
  const c = useColors();
  const [value, setValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const trimmed = value.trim();
  const isDup = existing.some(n => n.toLowerCase() === trimmed.toLowerCase());
  const canAdd = !!trimmed && !isDup && !adding;

  async function handleAdd() {
    if (!canAdd) return;
    setAdding(true);
    setError('');
    try {
      await onAdd(trimmed);
      setValue('');
    } catch {
      setError('Failed to add. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: tokens.typography.weightBold, color: c.textSecondary, mb: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Name
        </Typography>
        <TextField
          size="small"
          fullWidth
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Creator name"
          helperText={isDup ? 'Already following.' : 'Your node will proactively cache all content from this creator.'}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.82rem', bgcolor: c.surface,
              '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
              '&:hover fieldset': { borderColor: c.accent },
              '&.Mui-focused fieldset': { borderColor: c.accent },
            },
            '& input': { color: c.textPrimary },
            '& .MuiFormHelperText-root': { fontSize: '0.7rem', color: isDup ? c.error : c.textSecondary },
          }}
        />
      </Box>

      {error && <Typography sx={{ fontSize: '0.75rem', color: c.error }}>{error}</Typography>}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={onBack}
          startIcon={<ArrowBackIcon sx={{ fontSize: '0.85rem' }} />}
          sx={{ color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { bgcolor: c.borderLight } }}
        >
          Back
        </Button>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={handleAdd}
          disabled={!canAdd}
          sx={{
            bgcolor: c.accent, color: '#fff', borderRadius: '50px', fontSize: '0.75rem',
            '&:hover': { bgcolor: c.accentHover },
            '&.Mui-disabled': { opacity: 0.35, bgcolor: c.accent, color: '#fff' },
          }}
        >
          {adding ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Follow'}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Person block wizard form ──────────────────────────────────────────────────

function PersonBlockWizard({
  existingNames,
  existingAddresses,
  existingChatNames,
  existingChatAddresses,
  onAdd,
  onBack,
}: {
  existingNames: string[];
  existingAddresses: string[];
  existingChatNames: string[];
  existingChatAddresses: string[];
  onAdd: (value: string, isAddress: boolean, blockContent: boolean, blockChat: boolean) => Promise<void>;
  onBack: () => void;
}) {
  const c = useColors();
  const [value, setValue] = useState('');
  const [isAddress, setIsAddress] = useState(false);
  const [blockContent, setBlockContent] = useState(true);
  const [blockChat, setBlockChat] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const trimmed = value.trim();
  const alreadyHasContent = isAddress ? existingAddresses.includes(trimmed) : existingNames.includes(trimmed);
  const alreadyHasChat = isAddress ? existingChatAddresses.includes(trimmed) : existingChatNames.includes(trimmed);
  const isDup = (blockContent && alreadyHasContent) || (blockChat && alreadyHasChat);
  const nothingSelected = !blockContent && !blockChat;
  const canAdd = !!trimmed && !isDup && !nothingSelected && !adding;

  async function handleAdd() {
    if (!canAdd) return;
    setAdding(true);
    setError('');
    try {
      const actualContent = blockContent && !alreadyHasContent;
      const actualChat = blockChat && !alreadyHasChat;
      await onAdd(trimmed, isAddress, actualContent, actualChat);
      setValue('');
      setIsAddress(false);
      setBlockContent(true);
      setBlockChat(true);
    } catch {
      setError('Failed to add. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const labelSx = {
    fontSize: '0.68rem', fontWeight: tokens.typography.weightBold,
    color: c.textSecondary, mb: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Input + type toggle */}
      <Box>
        <Typography sx={labelSx}>Name or address</Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            size="small"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={isAddress ? 'Q…' : 'Creator name'}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                fontSize: '0.82rem', bgcolor: c.surface,
                fontFamily: isAddress ? 'monospace' : undefined,
                '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
                '&:hover fieldset': { borderColor: c.error },
                '&.Mui-focused fieldset': { borderColor: c.error },
              },
              '& input': { color: c.textPrimary, fontFamily: isAddress ? 'monospace' : undefined },
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={isAddress ? 'address' : 'name'}
            onChange={(_, v) => { if (v) setIsAddress(v === 'address'); }}
            sx={{ alignSelf: 'center', flexShrink: 0 }}
          >
            <ToggleButton value="name" sx={{ fontSize: '0.68rem', py: '5px', px: 1.25, color: c.textSecondary, '&.Mui-selected': { color: c.textPrimary, bgcolor: c.borderLight } }}>
              Name
            </ToggleButton>
            <ToggleButton value="address" sx={{ fontSize: '0.68rem', py: '5px', px: 1.25, color: c.textSecondary, '&.Mui-selected': { color: c.textPrimary, bgcolor: c.borderLight } }}>
              Address
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* What to block */}
      <Box>
        <Typography sx={labelSx}>Block from</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={blockContent}
                onChange={e => setBlockContent(e.target.checked)}
                size="small"
                sx={{ color: c.textSecondary, '&.Mui-checked': { color: c.error } }}
              />
            }
            label={<Typography sx={{ fontSize: '0.82rem', color: c.textPrimary }}>Their content</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={blockChat}
                onChange={e => setBlockChat(e.target.checked)}
                size="small"
                sx={{ color: c.textSecondary, '&.Mui-checked': { color: c.error } }}
              />
            }
            label={<Typography sx={{ fontSize: '0.82rem', color: c.textPrimary }}>Their chat messages</Typography>}
          />
        </Box>
      </Box>

      {isDup && <Typography sx={{ fontSize: '0.72rem', color: c.error }}>Already blocked with those settings.</Typography>}
      {nothingSelected && <Typography sx={{ fontSize: '0.72rem', color: c.error }}>Select at least one thing to block.</Typography>}
      {error && <Typography sx={{ fontSize: '0.75rem', color: c.error }}>{error}</Typography>}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={onBack}
          startIcon={<ArrowBackIcon sx={{ fontSize: '0.85rem' }} />}
          sx={{ color: c.textSecondary, borderRadius: '50px', fontSize: '0.75rem', '&:hover': { bgcolor: c.borderLight } }}
        >
          Back
        </Button>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={handleAdd}
          disabled={!canAdd}
          sx={{
            bgcolor: c.error, color: '#fff', borderRadius: '50px', fontSize: '0.75rem',
            '&:hover': { filter: 'brightness(0.9)' },
            '&.Mui-disabled': { opacity: 0.35, bgcolor: c.error, color: '#fff' },
          }}
        >
          {adding ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Block'}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Wizard panel ─────────────────────────────────────────────────────────────

type WizardStep = 'closed' | 'choice' | 'person' | 'content';

function WizardPanel({
  mode,
  followedNames,
  existingPatterns,
  blockedNames,
  blockedAddresses,
  blockedChatNames,
  blockedChatAddresses,
  onFollowPerson,
  onFollowPattern,
  onBlockPerson,
  onBlockPattern,
}: {
  mode: 'follow' | 'block';
  followedNames: string[];
  existingPatterns: string[];
  blockedNames: string[];
  blockedAddresses: string[];
  blockedChatNames: string[];
  blockedChatAddresses: string[];
  onFollowPerson: (name: string) => Promise<void>;
  onFollowPattern: (pattern: string) => Promise<void>;
  onBlockPerson: (value: string, isAddress: boolean, content: boolean, chat: boolean) => Promise<void>;
  onBlockPattern: (pattern: string) => Promise<void>;
}) {
  const c = useColors();
  const [step, setStep] = useState<WizardStep>('closed');
  const accent = mode === 'block' ? c.error : c.accent;

  if (step === 'closed') {
    return (
      <Button
        size="small"
        startIcon={<AddIcon sx={{ fontSize: '0.9rem' }} />}
        onClick={() => setStep('choice')}
        sx={{
          color: accent, borderRadius: '50px', fontSize: '0.78rem',
          border: `1.5px solid ${accent}40`,
          px: 1.5, py: 0.4,
          '&:hover': { bgcolor: `${accent}0d`, borderColor: accent },
          transition: '0.12s ease',
        }}
      >
        {mode === 'follow' ? 'Follow something' : 'Block something'}
      </Button>
    );
  }

  return (
    <Box sx={{
      p: 2, mb: 0.5,
      bgcolor: c.surface,
      border: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
      borderRadius: `${tokens.shape.radius}px`,
    }}>
      {step === 'choice' && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: tokens.typography.weightBold, color: c.textPrimary }}>
              What would you like to {mode}?
            </Typography>
            <IconButton size="small" onClick={() => setStep('closed')} sx={{ color: c.textSecondary, '&:hover': { color: c.textPrimary } }}>
              <CloseIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={() => setStep('person')}
              startIcon={<PersonIcon />}
              sx={{
                borderColor: c.borderLight, color: c.textPrimary,
                borderRadius: `${tokens.shape.radius}px`, fontSize: '0.82rem',
                flex: 1, justifyContent: 'flex-start', px: 2, py: 1.25,
                '&:hover': { borderColor: accent, bgcolor: `${accent}08` },
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Box sx={{ fontWeight: tokens.typography.weightBold }}>A person</Box>
                <Box sx={{ fontSize: '0.68rem', color: c.textSecondary, fontWeight: 400 }}>
                  {mode === 'follow' ? 'By name - proactively cache their content' : 'By name or address - blocks content and/or chat'}
                </Box>
              </Box>
            </Button>
            <Button
              variant="outlined"
              onClick={() => setStep('content')}
              startIcon={mode === 'follow' ? <StarBorderIcon /> : <BlockIcon />}
              sx={{
                borderColor: c.borderLight, color: c.textPrimary,
                borderRadius: `${tokens.shape.radius}px`, fontSize: '0.82rem',
                flex: 1, justifyContent: 'flex-start', px: 2, py: 1.25,
                '&:hover': { borderColor: accent, bgcolor: `${accent}08` },
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Box sx={{ fontWeight: tokens.typography.weightBold }}>Content pattern</Box>
                <Box sx={{ fontSize: '0.68rem', color: c.textSecondary, fontWeight: 400 }}>
                  {mode === 'follow' ? 'By type, creator, or specific file' : 'By service type, creator pattern, or specific file'}
                </Box>
              </Box>
            </Button>
          </Box>
        </Box>
      )}

      {step === 'person' && mode === 'follow' && (
        <PersonFollowWizard
          existing={followedNames}
          onAdd={async name => { await onFollowPerson(name); setStep('closed'); }}
          onBack={() => setStep('choice')}
        />
      )}

      {step === 'person' && mode === 'block' && (
        <PersonBlockWizard
          existingNames={blockedNames}
          existingAddresses={blockedAddresses}
          existingChatNames={blockedChatNames}
          existingChatAddresses={blockedChatAddresses}
          onAdd={async (v, isAddr, content, chat) => { await onBlockPerson(v, isAddr, content, chat); setStep('closed'); }}
          onBack={() => setStep('choice')}
        />
      )}

      {step === 'content' && (
        <ContentPatternWizard
          mode={mode}
          existing={existingPatterns}
          onAdd={async pattern => {
            if (mode === 'follow') await onFollowPattern(pattern);
            else await onBlockPattern(pattern);
            setStep('closed');
          }}
          onBack={() => setStep('choice')}
        />
      )}
    </Box>
  );
}

// ─── Follow tab ───────────────────────────────────────────────────────────────

function FollowTab({
  followed,
  follow,
  unfollow,
}: {
  followed: string[];
  follow: (p: string) => Promise<void>;
  unfollow: (p: string) => Promise<void>;
}) {
  const c = useColors();
  const [followedNames, setFollowedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getList('followedNames').then(r => { setFollowedNames(r); setLoading(false); });
  }, []);

  async function handleFollowPerson(name: string) {
    await addToList('followedNames', [name]);
    setFollowedNames(prev => [...prev, name]);
  }

  async function handleUnfollowPerson(name: string) {
    await removeFromList('followedNames', [name]);
    setFollowedNames(prev => prev.filter(n => n !== name));
  }

  const totalCount = followedNames.length + followed.length;
  const isEmpty = !loading && totalCount === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <WizardPanel
        mode="follow"
        followedNames={followedNames}
        existingPatterns={followed}
        blockedNames={[]} blockedAddresses={[]} blockedChatNames={[]} blockedChatAddresses={[]}
        onFollowPerson={handleFollowPerson}
        onFollowPattern={follow}
        onBlockPerson={async () => {}}
        onBlockPattern={async () => {}}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} sx={{ color: c.accent }} />
        </Box>
      ) : isEmpty ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <StarBorderIcon sx={{ fontSize: '2rem', color: c.textSecondary, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
            Nothing followed yet.
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, mt: 0.5 }}>
            Follow creators or content patterns to have your node cache them proactively.
          </Typography>
        </Box>
      ) : (
        <>
          {followedNames.map(name => (
            <PersonFollowItem
              key={name}
              name={name}
              onRemove={() => handleUnfollowPerson(name)}
            />
          ))}
          {followed.map(pattern => (
            <PatternItem
              key={pattern}
              pattern={pattern}
              onRemove={() => unfollow(pattern)}
            />
          ))}
        </>
      )}
    </Box>
  );
}

// ─── Block tab ────────────────────────────────────────────────────────────────

function mergePersonBlocks(
  names: string[],
  addresses: string[],
  chatNames: string[],
  chatAddresses: string[],
): PersonBlockEntry[] {
  const map = new Map<string, PersonBlockEntry>();
  for (const n of names) {
    map.set(n, { value: n, isAddress: false, blockedContent: true, blockedChat: false });
  }
  for (const n of chatNames) {
    const e = map.get(n);
    if (e) e.blockedChat = true;
    else map.set(n, { value: n, isAddress: false, blockedContent: false, blockedChat: true });
  }
  for (const a of addresses) {
    map.set(a, { value: a, isAddress: true, blockedContent: true, blockedChat: false });
  }
  for (const a of chatAddresses) {
    const e = map.get(a);
    if (e) e.blockedChat = true;
    else map.set(a, { value: a, isAddress: true, blockedContent: false, blockedChat: true });
  }
  return Array.from(map.values());
}

function BlockTab({
  blocked,
  block,
  unblock,
}: {
  blocked: string[];
  block: (p: string) => Promise<void>;
  unblock: (p: string) => Promise<void>;
}) {
  const c = useColors();
  const [blockedNames,        setBlockedNames]        = useState<string[]>([]);
  const [blockedAddresses,    setBlockedAddresses]    = useState<string[]>([]);
  const [blockedChatNames,    setBlockedChatNames]    = useState<string[]>([]);
  const [blockedChatAddresses,setBlockedChatAddresses]= useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getList('blockedNames'),
      getList('blockedAddresses'),
      getList('blockedChatNames'),
      getList('blockedChatAddresses'),
    ]).then(([bn, ba, bcn, bca]) => {
      setBlockedNames(bn);
      setBlockedAddresses(ba);
      setBlockedChatNames(bcn);
      setBlockedChatAddresses(bca);
      setLoading(false);
    });
  }, []);

  const personBlocks = useMemo(
    () => mergePersonBlocks(blockedNames, blockedAddresses, blockedChatNames, blockedChatAddresses),
    [blockedNames, blockedAddresses, blockedChatNames, blockedChatAddresses],
  );

  async function handleBlockPerson(value: string, isAddress: boolean, content: boolean, chat: boolean) {
    const adds: Promise<boolean>[] = [];
    if (content) adds.push(addToList(isAddress ? 'blockedAddresses' : 'blockedNames', [value]));
    if (chat)    adds.push(addToList(isAddress ? 'blockedChatAddresses' : 'blockedChatNames', [value]));
    await Promise.all(adds);
    if (content) {
      if (isAddress) setBlockedAddresses(prev => [...prev, value]);
      else           setBlockedNames(prev => [...prev, value]);
    }
    if (chat) {
      if (isAddress) setBlockedChatAddresses(prev => [...prev, value]);
      else           setBlockedChatNames(prev => [...prev, value]);
    }
  }

  async function handleRemoveBadge(entry: PersonBlockEntry, which: 'content' | 'chat' | 'all') {
    const removes: Promise<boolean>[] = [];
    const removeContent = which === 'content' || which === 'all';
    const removeChat    = which === 'chat'    || which === 'all';

    if (removeContent && entry.blockedContent) {
      removes.push(removeFromList(entry.isAddress ? 'blockedAddresses' : 'blockedNames', [entry.value]));
    }
    if (removeChat && entry.blockedChat) {
      removes.push(removeFromList(entry.isAddress ? 'blockedChatAddresses' : 'blockedChatNames', [entry.value]));
    }
    await Promise.all(removes);

    if (removeContent && entry.blockedContent) {
      if (entry.isAddress) setBlockedAddresses(prev => prev.filter(v => v !== entry.value));
      else                 setBlockedNames(prev => prev.filter(v => v !== entry.value));
    }
    if (removeChat && entry.blockedChat) {
      if (entry.isAddress) setBlockedChatAddresses(prev => prev.filter(v => v !== entry.value));
      else                 setBlockedChatNames(prev => prev.filter(v => v !== entry.value));
    }
  }

  const totalCount = personBlocks.length + blocked.length;
  const isEmpty = !loading && totalCount === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <WizardPanel
        mode="block"
        followedNames={[]}
        existingPatterns={blocked}
        blockedNames={blockedNames}
        blockedAddresses={blockedAddresses}
        blockedChatNames={blockedChatNames}
        blockedChatAddresses={blockedChatAddresses}
        onFollowPerson={async () => {}}
        onFollowPattern={async () => {}}
        onBlockPerson={handleBlockPerson}
        onBlockPattern={block}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} sx={{ color: c.accent }} />
        </Box>
      ) : isEmpty ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <BlockIcon sx={{ fontSize: '2rem', color: c.textSecondary, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ fontSize: '0.85rem', color: c.textSecondary }}>
            Nothing blocked.
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: c.textSecondary, mt: 0.5 }}>
            Block people or content patterns to filter them from search results and notifications.
          </Typography>
        </Box>
      ) : (
        <>
          {personBlocks.map(entry => (
            <PersonBlockItem
              key={entry.value}
              entry={entry}
              onRemoveBadge={which => handleRemoveBadge(entry, which)}
            />
          ))}
          {blocked.map(pattern => (
            <PatternItem
              key={pattern}
              pattern={pattern}
              onRemove={() => unblock(pattern)}
              accentColor={c.error}
            />
          ))}
        </>
      )}
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ListsPage() {
  const c = useColors();
  const { blocked, followed, block, unblock, follow, unfollow } = useQdnLists();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{
      pt: `calc(var(--publish-top-bar-height, ${tokens.spacing.topBarHeight}px) + 24px)`,
      pb: 6, px: { xs: 2, md: 4 },
      maxWidth: 720, mx: 'auto',
    }}>
      <Typography sx={{
        fontWeight: tokens.typography.weightBlack, fontSize: '1.5rem',
        letterSpacing: '-0.02em', color: c.textPrimary, mb: 0.5,
      }}>
        Lists
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mb: 3 }}>
        Control which content your node follows and what gets filtered out.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { bgcolor: c.accent },
          '& .MuiTab-root': { fontSize: '0.82rem', fontWeight: tokens.typography.weightBold, color: c.textSecondary, textTransform: 'none', minHeight: 40, px: 2 },
          '& .Mui-selected': { color: c.accent },
          borderBottom: `${tokens.shape.borderWidth} solid ${c.borderLight}`,
        }}
      >
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              Following
              {followed.length > 0 && (
                <Box sx={{ fontSize: '0.6rem', fontWeight: tokens.typography.weightBold, bgcolor: tab === 0 ? c.accent : c.borderLight, color: tab === 0 ? '#fff' : c.textSecondary, px: 0.75, py: 0.1, borderRadius: '50px' }}>
                  {followed.length}
                </Box>
              )}
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              Blocking
              {blocked.length > 0 && (
                <Box sx={{ fontSize: '0.6rem', fontWeight: tokens.typography.weightBold, bgcolor: tab === 1 ? c.error : c.borderLight, color: tab === 1 ? '#fff' : c.textSecondary, px: 0.75, py: 0.1, borderRadius: '50px' }}>
                  {blocked.length}
                </Box>
              )}
            </Box>
          }
        />
      </Tabs>

      {tab === 0 && (
        <FollowTab
          followed={followed}
          follow={follow}
          unfollow={unfollow}
        />
      )}
      {tab === 1 && (
        <BlockTab
          blocked={blocked}
          block={block}
          unblock={unblock}
        />
      )}
    </Box>
  );
}
