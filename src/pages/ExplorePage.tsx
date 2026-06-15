import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Button, Chip, CircularProgress, InputAdornment,
  TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExploreIcon from '@mui/icons-material/Explore';
import { useColors } from '../theme/ColorTokensContext';
import { tokens } from '../theme/tokens';
import { searchResources } from '../api/qortal';
import type { QdnResource } from '../types';

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

function ResourceRow({ r, last }: { r: QdnResource; last: boolean }) {
  const c = useColors();
  return (
    <Box sx={{
      px: 2.5, py: 1.75,
      display: 'flex', alignItems: 'center', gap: 2,
      borderBottom: last ? 'none' : `1px solid ${c.borderLight}`,
      '&:hover': { bgcolor: c.borderLight },
      transition: '0.12s ease',
    }}>
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
    </Box>
  );
}

export function ExplorePage() {
  const c = useColors();
  const [searchParams] = useSearchParams();
  const initialName = searchParams.get('name') ?? '';
  const didInit = useRef(false);

  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [queryInput, setQueryInput]       = useState(initialName);
  const [activeQuery, setActiveQuery]     = useState(initialName);

  const [results, setResults]       = useState<QdnResource[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [offset, setOffset]         = useState(0);

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

  // Initial load — use deep-link name param if present
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void doSearch('ALL', initialName, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServiceChange(s: string) {
    setServiceFilter(s);
    setOffset(0);
    void doSearch(s, activeQuery, true);
  }

  function handleSearch() {
    setActiveQuery(queryInput);
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
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
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
            <ResourceRow key={`${r.service}-${r.name}-${r.identifier}`} r={r} last={i === results.length - 1} />
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
    </Box>
  );
}
