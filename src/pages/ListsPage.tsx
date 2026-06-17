import { useState, useEffect } from 'react';
import {
  Box, Button, Chip, CircularProgress, IconButton,
  MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import BlockIcon from '@mui/icons-material/Block';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { getList, addToList, removeFromList } from '../api/qortal';
import { useQdnLists } from '../hooks/useQdnLists';
import {
  buildPattern, patternLabel, patternScope,
  type PatternScope,
} from '../lib/qdnPattern';
import { SERVICE_TYPES } from '../types';

// ─── Pattern scope badge ───────────────────────────────────────────────────────

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
      flexShrink: 0,
      lineHeight: 1.5,
    }}>
      {SCOPE_LABEL[scope]}
    </Box>
  );
}

// ─── Single pattern entry ──────────────────────────────────────────────────────

function PatternItem({
  pattern,
  onRemove,
}: {
  pattern: string;
  onRemove: () => Promise<void>;
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
            sx={{
              color: c.textSecondary,
              '&:hover': { color: c.error },
              transition: '0.12s ease',
            }}
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

// ─── Wildcard-toggleable text field ───────────────────────────────────────────

function WildcardField({
  value,
  onChange,
  isWild,
  onToggleWild,
  placeholder,
  width = 130,
}: {
  value: string;
  onChange: (v: string) => void;
  isWild: boolean;
  onToggleWild: () => void;
  placeholder: string;
  width?: number;
}) {
  const c = useColors();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <TextField
        size="small"
        value={isWild ? '' : value}
        onChange={e => onChange(e.target.value)}
        disabled={isWild}
        placeholder={isWild ? '—' : placeholder}
        sx={{
          width,
          '& .MuiOutlinedInput-root': {
            fontSize: '0.8rem',
            bgcolor: isWild ? c.borderLight : c.surface,
            '& fieldset': { borderColor: c.borderLight },
            '&:hover fieldset': { borderColor: isWild ? c.borderLight : c.accent },
            '&.Mui-focused fieldset': { borderColor: c.accent },
          },
          '& input': { color: c.textPrimary, fontFamily: 'monospace' },
          '& input::placeholder': { fontFamily: 'inherit' },
        }}
      />
      <Tooltip title={isWild ? 'Enter a specific value' : 'Match any value (wildcard)'}>
        <Chip
          label="*"
          size="small"
          onClick={onToggleWild}
          sx={{
            fontFamily: 'monospace', fontWeight: tokens.typography.weightBold,
            fontSize: '0.8rem', cursor: 'pointer', px: 0.25,
            bgcolor: isWild ? c.accent : 'transparent',
            color:   isWild ? c.accentText : c.textSecondary,
            border:  `1.5px solid ${isWild ? c.accent : c.borderLight}`,
            '&:hover': { bgcolor: isWild ? c.accentHover : c.borderLight },
            transition: '0.12s ease',
          }}
        />
      </Tooltip>
    </Box>
  );
}

// ─── Pattern add form ──────────────────────────────────────────────────────────

function PatternForm({
  onAdd,
  existing,
  accentOverride,
}: {
  onAdd: (pattern: string) => Promise<void>;
  existing: string[];
  accentOverride?: string;
}) {
  const c = useColors();
  const accent = accentOverride ?? c.accent;

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
      // reset name+id fields after successful add
      setName('');
      setId('');
      setNameWild(true);
      setIdWild(true);
    } catch {
      setError('Failed to add pattern. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const selectSx = {
    minWidth: 152, fontSize: '0.8rem',
    '& .MuiSelect-select': { py: '6.5px' },
    '& fieldset': { borderColor: c.borderLight },
    '&:hover fieldset': { borderColor: c.accent },
    '&.Mui-focused fieldset': { borderColor: c.accent },
    color: c.textPrimary,
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Row: service / name / identifier */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        {/* Service */}
        <Select
          size="small"
          value={service}
          onChange={e => setService(e.target.value)}
          sx={selectSx}
          MenuProps={{ PaperProps: { sx: { bgcolor: c.surface, color: c.textPrimary } } }}
        >
          <MenuItem value="*" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>* (any type)</MenuItem>
          {SERVICE_TYPES.map(st => (
            <MenuItem key={st.value} value={st.value} sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {st.value}
            </MenuItem>
          ))}
        </Select>

        <Typography sx={{ color: c.textSecondary, fontFamily: 'monospace', fontSize: '1rem', userSelect: 'none' }}>
          /
        </Typography>

        <WildcardField
          value={name}
          onChange={setName}
          isWild={nameWild}
          onToggleWild={() => setNameWild(w => !w)}
          placeholder="name"
        />

        <Typography sx={{ color: c.textSecondary, fontFamily: 'monospace', fontSize: '1rem', userSelect: 'none' }}>
          /
        </Typography>

        <WildcardField
          value={id}
          onChange={setId}
          isWild={idWild}
          onToggleWild={() => setIdWild(w => !w)}
          placeholder="identifier"
          width={160}
        />

        <Button
          variant="contained"
          disableElevation
          size="small"
          onClick={handleAdd}
          disabled={!canAdd}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          sx={{
            bgcolor: accent,
            color: c.accentText,
            borderRadius: '50px',
            px: 2.5, fontSize: '0.72rem',
            '&:hover': { bgcolor: c.accentHover },
            '&.Mui-disabled': { opacity: 0.35, bgcolor: accent, color: c.accentText },
          }}
        >
          {adding ? <CircularProgress size={12} sx={{ color: c.accentText }} /> : 'Add'}
        </Button>
      </Box>

      {/* Preview */}
      <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{
          fontFamily: 'monospace', fontSize: '0.78rem',
          color: c.textPrimary, fontWeight: tokens.typography.weightBold,
        }}>
          {pattern}
        </Typography>
        <Typography sx={{ fontSize: '0.67rem', color: c.textSecondary }}>
          — {label}
        </Typography>
      </Box>

      {/* Hint line */}
      <Typography sx={{ fontSize: '0.65rem', color: c.textSecondary, mt: 0.25 }}>
        Use <Box component="span" sx={{ fontFamily: 'monospace' }}>*</Box> to match anything.
        &nbsp;Examples: <Box component="span" sx={{ fontFamily: 'monospace' }}>VIDEO/*/cat*</Box>,{' '}
        <Box component="span" sx={{ fontFamily: 'monospace' }}>*/TOM</Box>
      </Typography>

      {isDup    && <Typography sx={{ fontSize: '0.72rem', color: c.error, mt: 0.5 }}>Already in list.</Typography>}
      {isAllWild && !isDup && <Typography sx={{ fontSize: '0.72rem', color: c.error, mt: 0.5 }}>Pattern must be more specific than */*/*.</Typography>}
      {error    && <Typography sx={{ fontSize: '0.72rem', color: c.error, mt: 0.5 }}>{error}</Typography>}
    </Box>
  );
}

// ─── QDN pattern list section ──────────────────────────────────────────────────

function QdnListSection({
  title,
  description,
  icon,
  items,
  onAdd,
  onRemove,
  accentOverride,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: string[];
  onAdd: (pattern: string) => Promise<void>;
  onRemove: (pattern: string) => Promise<void>;
  accentOverride?: string;
}) {
  const c = useColors();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box sx={{ color: accentOverride ?? c.accent, display: 'flex' }}>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1rem', color: c.textPrimary }}>
          {title}
        </Typography>
        {items.length > 0 && (
          <Box sx={{
            fontSize: '0.65rem', fontWeight: tokens.typography.weightBold,
            bgcolor: c.borderLight, color: c.textSecondary,
            px: 0.75, py: 0.1, borderRadius: '50px',
          }}>
            {items.length}
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mb: 1.5 }}>
        {description}
      </Typography>

      {/* Pattern list */}
      {items.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1 }}>
          {items.map(pattern => (
            <PatternItem
              key={pattern}
              pattern={pattern}
              onRemove={() => onRemove(pattern)}
            />
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, fontStyle: 'italic', mb: 0.5 }}>
          None
        </Typography>
      )}

      <PatternForm onAdd={onAdd} existing={items} accentOverride={accentOverride} />
    </Box>
  );
}

// ─── Simple name/address list section (existing behaviour) ─────────────────────

function SimpleListSection({
  title,
  description,
  listName,
  isAddress,
}: {
  title: string;
  description: string;
  listName: string;
  isAddress?: boolean;
}) {
  const c = useColors();
  const [items,  setItems]  = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [input,  setInput]  = useState('');
  const [adding, setAdding] = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getList(listName);
      setItems(res);
      setLoading(false);
    })();
  }, [listName]);

  async function handleAdd() {
    const value = input.trim();
    if (!value) return;
    if (items.some(i => i.toLowerCase() === value.toLowerCase())) {
      setInput('');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await addToList(listName, [value]);
      setItems(prev => [...prev, value]);
      setInput('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(item: string) {
    setError('');
    try {
      await removeFromList(listName, [item]);
      setItems(prev => prev.filter(i => i !== item));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove.');
    }
  }

  return (
    <Box>
      <Typography sx={{ fontWeight: tokens.typography.weightBlack, fontSize: '1rem', color: c.textPrimary, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mb: 2 }}>
        {description}
      </Typography>

      {loading ? (
        <CircularProgress size={18} sx={{ color: c.accent, mb: 1.5 }} />
      ) : (
        <>
          {items.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
              {items.map(item => (
                <Chip
                  key={item}
                  label={item}
                  size="small"
                  onDelete={() => handleRemove(item)}
                  sx={{
                    fontSize: isAddress ? '0.6rem' : '0.72rem',
                    fontFamily: isAddress ? 'monospace' : undefined,
                    fontWeight: tokens.typography.weightMedium,
                    bgcolor: c.borderLight,
                    color: c.textPrimary,
                    '& .MuiChip-deleteIcon': {
                      color: c.textSecondary,
                      '&:hover': { color: c.error },
                    },
                  }}
                />
              ))}
            </Box>
          )}

          {items.length === 0 && (
            <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mb: 1.5, fontStyle: 'italic' }}>
              None
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder={isAddress ? 'Q...' : 'Name'}
              size="small"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  bgcolor: c.surface,
                  '& fieldset': { borderColor: c.borderLight, borderWidth: tokens.shape.borderWidth },
                  '&:hover fieldset': { borderColor: c.accent },
                  '&.Mui-focused fieldset': { borderColor: c.accent },
                },
                '& input': {
                  color: c.textPrimary,
                  fontSize: '0.8rem',
                  fontFamily: isAddress ? 'monospace' : undefined,
                },
              }}
            />
            <Button
              onClick={handleAdd}
              disabled={!input.trim() || adding}
              variant="contained"
              disableElevation
              sx={{
                bgcolor: c.accent,
                color: c.accentText,
                borderRadius: '50px',
                '&:hover': { bgcolor: c.accentHover },
                opacity: !input.trim() || adding ? 0.35 : 1,
                minWidth: 'auto',
                px: 2.5,
                fontSize: '0.75rem',
              }}
            >
              {adding ? <CircularProgress size={14} sx={{ color: c.accentText }} /> : 'Add'}
            </Button>
          </Box>

          {error && (
            <Typography sx={{ fontSize: '0.72rem', color: c.error, mt: 0.75 }}>
              {error}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

// ─── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  const c = useColors();
  return <Box sx={{ borderTop: `${tokens.shape.borderWidth} solid ${c.borderLight}`, my: 4 }} />;
}

// ─── Section label (for grouping) ─────────────────────────────────────────────

function SectionGroup({ label }: { label: string }) {
  const c = useColors();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
      <Typography sx={{
        fontSize: '0.6rem', fontWeight: tokens.typography.weightBold,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: c.textSecondary, whiteSpace: 'nowrap',
      }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, borderTop: `${tokens.shape.borderWidth} solid ${c.borderLight}` }} />
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ListsPage() {
  const c = useColors();
  const { blocked, followed, block, unblock, follow, unfollow } = useQdnLists();

  return (
    <Box sx={{
      pt: `${tokens.spacing.topBarHeight + 24}px`,
      pb: 6, px: { xs: 2, md: 4 },
      maxWidth: 720, mx: 'auto',
    }}>
      <Typography sx={{
        fontWeight: tokens.typography.weightBlack, fontSize: '1.5rem',
        letterSpacing: '-0.02em', color: c.textPrimary, mb: 0.5,
      }}>
        Lists
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: c.textSecondary, mb: 4 }}>
        Control which QDN content your node follows or filters out.
      </Typography>

      {/* ── QDN Patterns ───────────────────────────────────────────────────── */}
      <SectionGroup label="QDN Patterns" />

      <QdnListSection
        title="Followed QDN"
        description="Your node proactively fetches and caches content matching these patterns. Use glob wildcards to follow broad categories — e.g. a whole service type, or everything from a specific name."
        icon={<StarIcon sx={{ fontSize: '1.1rem' }} />}
        items={followed}
        onAdd={follow}
        onRemove={unfollow}
      />

      <Divider />

      <QdnListSection
        title="Blocked QDN"
        description="Content matching these patterns is hidden from QDN search results and suppressed in notifications. Blocking a pattern also removes it from your followed list."
        icon={<BlockIcon sx={{ fontSize: '1.1rem' }} />}
        items={blocked}
        onAdd={block}
        onRemove={unblock}
        accentOverride={c.error}
      />

      {/* ── Name & Address Lists ───────────────────────────────────────────── */}
      <Divider />
      <SectionGroup label="Name & Address Lists" />

      <SimpleListSection
        title="Followed Names"
        description="Your node proactively fetches and caches all content from these names. Storage budget is divided across followed names."
        listName="followedNames"
      />

      <Divider />

      <SimpleListSection
        title="Blocked Names"
        description="Content from these names is filtered out of QDN search results and suppressed in notifications."
        listName="blockedNames"
      />

      <Divider />

      <SimpleListSection
        title="Blocked Addresses"
        description="Addresses whose content is excluded at the node level."
        listName="blockedAddresses"
        isAddress
      />

      {/* ── Chat Lists ─────────────────────────────────────────────────────── */}
      <Divider />
      <SectionGroup label="Chat" />

      <SimpleListSection
        title="Blocked Chat Names"
        description="Messages from these names are hidden in all chat channels."
        listName="blockedChatNames"
      />

      <Divider />

      <SimpleListSection
        title="Blocked Chat Addresses"
        description="Messages from these addresses are hidden in all chat channels."
        listName="blockedChatAddresses"
        isAddress
      />
    </Box>
  );
}
