export type PublishSource = { kind: 'token'; fileName: string; size: number; sourceToken: string };

export enum EnumTheme {
  DARK = 'dark',
  LIGHT = 'light',
}

export interface QdnResource {
  service: string;
  name: string;
  identifier: string;
  size?: number;
  status?: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  created?: number;
  updated?: number;
}

export interface ServiceTypeDef {
  value: string;
  label: string;
  maxSize?: string;
  note?: string;
}

// Shape of GET /arbitrary/services - core's live source of truth for QDN
// service types (see Service.java). "private" is spelled out in full because
// that's the JSON key core sends (isPrivate would be a mismatch).
export interface ArbitraryServiceInfo {
  id: string;
  value: number;
  maxSize: number | null;
  private: boolean;
  requiresEncryption: boolean;
  singleFile: boolean;
  supportsDirectories: boolean;
  requiresValidation: boolean;
}

// Hand-picked copy for the handful of services whose id doesn't title-case
// into a sensible label, or that need a callout beyond their size limit.
// Everything else is formatted generically from what core reports.
const SERVICE_LABEL_OVERRIDES: Record<string, { label?: string; note?: string }> = {
  JSON:              { label: 'JSON',   note: 'Must be valid JSON' },
  NFT:               { label: 'NFT' },
  GIF_REPOSITORY:    { label: 'GIF Repository', note: 'GIF files only' },
  QCHAT_ATTACHMENT:  { label: 'QChat Attachment' },
  QCHAT_AUDIO:       { label: 'QChat Audio' },
  QCHAT_IMAGE:       { label: 'QChat Image' },
  QCHAT_VOICE:       { label: 'QChat Voice' },
  IMAGE_GALLERY:     { note: 'Image files only' },
  WEBSITE:           { note: 'requires index.html' },
  AUTO_UPDATE:       { note: 'core auto-update system' },
  AUTO_UPDATE_BINARY: { note: 'core auto-update system' },
};

function titleCase(id: string): string {
  return id.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
}

function formatMaxSize(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  if (mib >= 1) return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB`;
  const kib = bytes / 1024;
  if (kib >= 1) return `${Number.isInteger(kib) ? kib : kib.toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

// Builds the Publish page's dropdown options from core's live service list,
// so a service type added to core shows up here without a code change.
// Encrypted/private variants are skipped - this tool doesn't implement the
// client-side encryption they require.
export function buildServiceTypes(apiServices: ArbitraryServiceInfo[]): ServiceTypeDef[] {
  const types = apiServices
    .filter(s => !s.private)
    .map((s): ServiceTypeDef => {
      const override = SERVICE_LABEL_OVERRIDES[s.id] ?? {};
      const genericNote = s.maxSize == null ? 'No size limit' : undefined;
      const note = override.note
        ? (genericNote ? `${genericNote} · ${override.note}` : override.note)
        : genericNote;
      return {
        value: s.id,
        label: override.label ?? titleCase(s.id),
        maxSize: s.maxSize != null ? formatMaxSize(s.maxSize) : undefined,
        note,
      };
    });

  types.sort((a, b) => {
    if (a.value === 'ARBITRARY_DATA') return -1;
    if (b.value === 'ARBITRARY_DATA') return 1;
    return a.label.localeCompare(b.label);
  });
  return types;
}

// Fallback used before the live list has loaded (or if a node is too old to
// expose GET /arbitrary/services). Kept in sync manually as a last resort.
export const DEFAULT_SERVICE_TYPES: ServiceTypeDef[] = [
  { value: 'ARBITRARY_DATA',       label: 'Arbitrary Data',       note: 'No size limit' },
  { value: 'APP',                  label: 'App',                  maxSize: '50 MiB' },
  { value: 'ATTACHMENT',           label: 'Attachment',           maxSize: '50 MiB' },
  { value: 'AUDIO',                label: 'Audio',                note: 'No size limit' },
  { value: 'AUTO_UPDATE',          label: 'Auto Update',          note: 'No size limit · core auto-update system' },
  { value: 'AUTO_UPDATE_BINARY',   label: 'Auto Update Binary',   note: 'No size limit · core auto-update system' },
  { value: 'BLOG',                 label: 'Blog',                 note: 'No size limit' },
  { value: 'BLOG_COMMENT',         label: 'Blog Comment',         maxSize: '500 KiB' },
  { value: 'BLOG_POST',            label: 'Blog Post',            note: 'No size limit' },
  { value: 'CHAIN_COMMENT',        label: 'Chain Comment',        maxSize: '239 bytes' },
  { value: 'CHAIN_DATA',           label: 'Chain Data',           maxSize: '239 bytes' },
  { value: 'CODE',                 label: 'Code',                 note: 'No size limit' },
  { value: 'COMMENT',              label: 'Comment',              maxSize: '500 KiB' },
  { value: 'COUPON',               label: 'Coupon',               note: 'No size limit' },
  { value: 'DATABASE',             label: 'Database',             note: 'No size limit' },
  { value: 'DOCUMENT',             label: 'Document',             note: 'No size limit' },
  { value: 'EXTENSION',            label: 'Extension',            note: 'No size limit' },
  { value: 'FILE',                 label: 'File',                 note: 'No size limit' },
  { value: 'FILES',                label: 'Files',                note: 'No size limit' },
  { value: 'GAME',                 label: 'Game',                 note: 'No size limit' },
  { value: 'GIF_REPOSITORY',       label: 'GIF Repository',       maxSize: '25 MiB', note: 'GIF files only' },
  { value: 'GIT_REPOSITORY',       label: 'Git Repository',       note: 'No size limit' },
  { value: 'IMAGE',                label: 'Image',                maxSize: '10 MiB' },
  { value: 'IMAGE_GALLERY',        label: 'Image Gallery',        maxSize: '50 MiB', note: 'Image files only' },
  { value: 'ITEM',                 label: 'Item',                 note: 'No size limit' },
  { value: 'JSON',                 label: 'JSON',                 maxSize: '25 KiB', note: 'Must be valid JSON' },
  { value: 'LIST',                 label: 'List',                 note: 'No size limit' },
  { value: 'MAIL',                 label: 'Mail',                 maxSize: '1 MiB' },
  { value: 'MESSAGE',              label: 'Message',              maxSize: '1 MiB' },
  { value: 'METADATA',             label: 'Metadata',             note: 'No size limit' },
  { value: 'NFT',                  label: 'NFT',                  note: 'No size limit' },
  { value: 'OFFER',                label: 'Offer',                note: 'No size limit' },
  { value: 'PLAYLIST',             label: 'Playlist',             note: 'No size limit' },
  { value: 'PLUGIN',               label: 'Plugin',               note: 'No size limit' },
  { value: 'PODCAST',              label: 'Podcast',              note: 'No size limit' },
  { value: 'PRODUCT',              label: 'Product',              note: 'No size limit' },
  { value: 'QCHAT_ATTACHMENT',     label: 'QChat Attachment',     maxSize: '1 MiB' },
  { value: 'QCHAT_AUDIO',          label: 'QChat Audio',          maxSize: '10 MiB' },
  { value: 'QCHAT_IMAGE',          label: 'QChat Image',          maxSize: '500 KiB' },
  { value: 'QCHAT_VOICE',          label: 'QChat Voice',          maxSize: '10 MiB' },
  { value: 'SNAPSHOT',             label: 'Snapshot',             note: 'No size limit' },
  { value: 'STORE',                label: 'Store',                note: 'No size limit' },
  { value: 'THUMBNAIL',            label: 'Thumbnail',            maxSize: '500 KiB' },
  { value: 'VIDEO',                label: 'Video',                note: 'No size limit' },
  { value: 'VOICE',                label: 'Voice',                maxSize: '10 MiB' },
  { value: 'WEBSITE',              label: 'Website',              note: 'No size limit · requires index.html' },
];
