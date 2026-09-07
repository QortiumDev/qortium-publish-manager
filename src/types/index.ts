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
// The notes come from actually grepping every Q-App and Qortium Home for a
// real consumer of each service (not just guessing from the name) - see
// "Not used by any app yet" for the ones nothing in this app set touches.
// Home's own service whitelist (electron/qdn-public-services.ts) additionally
// blocks PUBLISH_QDN_RESOURCE for anything not in its list, which is a
// separate, stricter gate than core's public/private split - flagged below
// wherever it makes a service unusable through the actual publish bridge.
const SERVICE_LABEL_OVERRIDES: Record<string, { label?: string; note?: string }> = {
  ARBITRARY_DATA:     { note: 'Generic catch-all · not currently publishable via Qortium Home' },
  APP:                { note: 'Rendered as an app, like this one' },
  ATTACHMENT:         { note: "Chat's generic file attachment" },
  AUDIO:              { note: "Radio's track format" },
  AUTO_UPDATE:        { note: "Core's own self-update channel · not currently publishable via Qortium Home" },
  AUTO_UPDATE_BINARY: { note: "Core's own self-update channel · not currently publishable via Qortium Home" },
  BLOG:               { note: 'Not used by any app yet' },
  BLOG_COMMENT:       { note: 'Repurposed by Radio as a request queue, not for comments' },
  BLOG_POST:          { note: "Recognized as a post in Profile's friend feed" },
  CHAIN_COMMENT:      { note: 'Not used by any app yet' },
  CHAIN_DATA:         { note: 'Not used by any app yet' },
  CODE:               { note: 'Not used by any app yet' },
  COMMENT:            { note: 'Not used by any app yet' },
  COUPON:             { note: 'Not used by any app yet' },
  DATABASE:           { note: 'Not used by any app yet' },
  DOCUMENT:           { note: "Library's document format · also profile bios, chat files" },
  EXTENSION:          { note: 'Not used by any app yet' },
  FILE:               { note: 'Generic downloadable file' },
  FILES:              { note: 'Generic downloadable file set' },
  GAME:               { note: "Games app's publish type" },
  GIF_REPOSITORY:     { label: 'GIF Repository', note: "GIF files only · Chat's GIF picker" },
  GIT_REPOSITORY:     { note: 'Not used by any app yet' },
  IMAGE:              { note: "Gallery's publish type; used for inline images everywhere" },
  IMAGE_GALLERY:      { note: 'Image files only · not used by any app yet' },
  ITEM:               { note: 'Not used by any app yet' },
  JSON:               { label: 'JSON', note: 'Must be valid JSON · e.g. contact cards' },
  LIST:               { note: 'Not used by any app yet' },
  MAIL:               { note: 'Not used by any app yet' },
  MESSAGE:            { note: 'Not used by any app yet' },
  METADATA:           { note: 'Not used by any app yet' },
  NFT:                { label: 'NFT', note: 'Not used by any app yet' },
  OFFER:              { note: 'Not used by any app yet' },
  PLAYLIST:           { note: "Video app's playlist type" },
  PLUGIN:             { note: 'Not used by any app yet' },
  PODCAST:            { note: 'Not used by any app yet' },
  PRODUCT:            { note: 'Not used by any app yet' },
  QCHAT_ATTACHMENT:   { label: 'QChat Attachment', note: 'Chat uses ATTACHMENT instead · not currently publishable via Qortium Home' },
  QCHAT_AUDIO:        { label: 'QChat Audio', note: 'Chat uses AUDIO instead · not currently publishable via Qortium Home' },
  QCHAT_IMAGE:        { label: 'QChat Image', note: "Chat's inline image messages" },
  QCHAT_VOICE:        { label: 'QChat Voice', note: 'Chat uses AUDIO instead · not currently publishable via Qortium Home' },
  SNAPSHOT:           { note: 'Not used by any app yet' },
  STORE:              { note: 'Not used by any app yet' },
  THUMBNAIL:          { note: 'Shared avatar convention across every app' },
  VIDEO:              { note: "Video app's channel/upload type" },
  VOICE:              { note: 'Not used by any app yet' },
  WEBSITE:            { note: 'requires index.html · renders as a standalone site' },
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

// Only what buildServiceTypes actually reads off a core service record - lets
// the bundled fallback snapshot below skip the rest of ArbitraryServiceInfo's
// fields, which don't affect what's rendered.
type ServiceSnapshot = Pick<ArbitraryServiceInfo, 'id' | 'maxSize' | 'private'>;

// Builds the Publish page's dropdown options from core's live service list,
// so a service type added to core shows up here without a code change.
// Encrypted/private variants are skipped - this tool doesn't implement the
// client-side encryption they require.
export function buildServiceTypes(apiServices: ServiceSnapshot[]): ServiceTypeDef[] {
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

// Snapshot of core's public services (id, max size in bytes, private flag)
// as of Service.java at the time this was written. Feeds buildServiceTypes()
// for the fallback list used before the live fetch resolves, or if a node is
// too old to expose GET /arbitrary/services. Kept in sync manually.
const DEFAULT_ARBITRARY_SERVICES: ServiceSnapshot[] = [
  { id: 'ARBITRARY_DATA',   maxSize: null,             private: false },
  { id: 'APP',              maxSize: 50 * 1024 * 1024, private: false },
  { id: 'ATTACHMENT',       maxSize: 50 * 1024 * 1024, private: false },
  { id: 'AUDIO',            maxSize: null,             private: false },
  { id: 'AUTO_UPDATE',      maxSize: null,             private: false },
  { id: 'AUTO_UPDATE_BINARY', maxSize: null,           private: false },
  { id: 'BLOG',             maxSize: null,             private: false },
  { id: 'BLOG_COMMENT',     maxSize: 500 * 1024,       private: false },
  { id: 'BLOG_POST',        maxSize: null,             private: false },
  { id: 'CHAIN_COMMENT',    maxSize: 239,              private: false },
  { id: 'CHAIN_DATA',       maxSize: 239,              private: false },
  { id: 'CODE',             maxSize: null,             private: false },
  { id: 'COMMENT',          maxSize: 500 * 1024,       private: false },
  { id: 'COUPON',           maxSize: null,             private: false },
  { id: 'DATABASE',         maxSize: null,             private: false },
  { id: 'DOCUMENT',         maxSize: null,             private: false },
  { id: 'EXTENSION',        maxSize: null,             private: false },
  { id: 'FILE',             maxSize: null,             private: false },
  { id: 'FILES',            maxSize: null,             private: false },
  { id: 'GAME',             maxSize: null,             private: false },
  { id: 'GIF_REPOSITORY',   maxSize: 25 * 1024 * 1024, private: false },
  { id: 'GIT_REPOSITORY',   maxSize: null,             private: false },
  { id: 'IMAGE',            maxSize: 10 * 1024 * 1024, private: false },
  { id: 'IMAGE_GALLERY',    maxSize: 50 * 1024 * 1024, private: false },
  { id: 'ITEM',             maxSize: null,             private: false },
  { id: 'JSON',             maxSize: 25 * 1024,        private: false },
  { id: 'LIST',             maxSize: null,             private: false },
  { id: 'MAIL',             maxSize: 1024 * 1024,      private: false },
  { id: 'MESSAGE',          maxSize: 1024 * 1024,      private: false },
  { id: 'METADATA',         maxSize: null,             private: false },
  { id: 'NFT',              maxSize: null,             private: false },
  { id: 'OFFER',            maxSize: null,             private: false },
  { id: 'PLAYLIST',         maxSize: null,             private: false },
  { id: 'PLUGIN',           maxSize: null,             private: false },
  { id: 'PODCAST',          maxSize: null,             private: false },
  { id: 'PRODUCT',          maxSize: null,             private: false },
  { id: 'QCHAT_ATTACHMENT', maxSize: 1024 * 1024,      private: false },
  { id: 'QCHAT_AUDIO',      maxSize: 10 * 1024 * 1024, private: false },
  { id: 'QCHAT_IMAGE',      maxSize: 500 * 1024,       private: false },
  { id: 'QCHAT_VOICE',      maxSize: 10 * 1024 * 1024, private: false },
  { id: 'SNAPSHOT',         maxSize: null,             private: false },
  { id: 'STORE',            maxSize: null,             private: false },
  { id: 'THUMBNAIL',        maxSize: 500 * 1024,       private: false },
  { id: 'VIDEO',            maxSize: null,             private: false },
  { id: 'VOICE',            maxSize: 10 * 1024 * 1024, private: false },
  { id: 'WEBSITE',          maxSize: null,             private: false },
];

export const DEFAULT_SERVICE_TYPES: ServiceTypeDef[] = buildServiceTypes(DEFAULT_ARBITRARY_SERVICES);
