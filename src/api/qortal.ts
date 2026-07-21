import type { PublishSource, QdnResource } from '../types';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { resolve((reader.result as string).split(',')[1] ?? ''); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function getUserAccount(): Promise<{ address: string; name: string | null }> {
  const res = await qdnRequest({ action: 'GET_SELECTED_ACCOUNT' }) as { address: string; name: string | null };
  return { address: res.address, name: res.name || null };
}

// Core returns title/description/tags/category nested under `metadata` for
// LIST_QDN_RESOURCES and SEARCH_QDN_RESOURCES; hoist them to the top level
// so every consumer can keep reading resource.title etc. directly.
type RawQdnResource = QdnResource & {
  metadata?: { title?: string; description?: string; tags?: string[]; category?: string };
};

function normalizeResource(raw: RawQdnResource): QdnResource {
  const { metadata, ...rest } = raw;
  return {
    ...rest,
    title: metadata?.title ?? raw.title,
    description: metadata?.description ?? raw.description,
    tags: metadata?.tags ?? raw.tags,
    category: metadata?.category ?? raw.category,
  };
}

export async function listResources(name: string, service?: string, offset = 0, limit = 100): Promise<QdnResource[]> {
  try {
    const res = await qdnRequest({
      action: 'LIST_QDN_RESOURCES',
      name,
      includeMetadata: true,
      limit,
      offset,
      reverse: true,
      ...(service ? { service } : {}),
    }) as RawQdnResource[];
    return (res ?? []).map(normalizeResource);
  } catch { return []; }
}

// Returns null if user canceled, throws if the action is not supported (caller should fall back to in-page picker).
export async function selectPublishSource(): Promise<PublishSource | null> {
  const res = await qdnRequest({ action: 'SELECT_QDN_PUBLISH_SOURCE', kind: 'file' }) as {
    canceled?: boolean; fileName?: string; size?: number; sourceToken?: string;
  };
  if (res.canceled || !res.sourceToken) return null;
  return { kind: 'token', fileName: res.fileName ?? '', size: res.size ?? 0, sourceToken: res.sourceToken };
}

export async function getNamesByAddress(address: string): Promise<string[]> {
  try {
    const res = await fetch(`/names/address/${encodeURIComponent(address)}?limit=0`);
    if (!res.ok) return [];
    const data = await res.json() as Array<{ name: string }>;
    return data.map(d => d.name).filter(Boolean);
  } catch { return []; }
}

export async function publishResource(opts: {
  service: string;
  name: string;
  source: PublishSource;
  identifier: string;
  title?: string;
  description?: string;
  tags?: string[];
  isMultiFileZip?: boolean;
}): Promise<void> {
  await qdnRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: opts.service,
    name: opts.name,
    identifier: opts.identifier,
    sourceToken: opts.source.sourceToken,
    filename: opts.source.fileName,
    ...(opts.title       ? { title: opts.title }             : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.tags?.length ? { tags: opts.tags }              : {}),
  });
}

export async function publishResourceBase64(opts: {
  service: string;
  name: string;
  data64: string;
  filename?: string;
  identifier: string;
  title?: string;
  description?: string;
  tags?: string[];
}): Promise<void> {
  await qdnRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: opts.service,
    name: opts.name,
    identifier: opts.identifier,
    data64: opts.data64,
    ...(opts.filename    ? { filename: opts.filename }       : {}),
    ...(opts.title       ? { title: opts.title }             : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.tags?.length ? { tags: opts.tags }              : {}),
  });
}

export async function deleteResource(service: string, name: string, identifier: string): Promise<void> {
  await qdnRequest({
    action: 'DELETE_QDN_RESOURCE',
    service,
    name,
    identifier,
  });
}

export async function getResource(service: string, name: string, identifier: string): Promise<QdnResource | null> {
  try {
    const res = await qdnRequest({
      action: 'LIST_QDN_RESOURCES',
      service,
      name,
      identifier,
      includeMetadata: true,
      limit: 1,
    }) as RawQdnResource[];
    return res?.[0] ? normalizeResource(res[0]) : null;
  } catch { return null; }
}

export async function fetchResourceAsBase64(service: string, name: string, identifier: string): Promise<string> {
  const res = await qdnRequest({
    action: 'FETCH_QDN_RESOURCE',
    service,
    name,
    identifier,
    encoding: 'BASE64',
  }) as string;
  return res;
}

export async function fetchResourceText(service: string, name: string, identifier: string): Promise<string> {
  const b64 = await fetchResourceAsBase64(service, name, identifier);
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function resizeImage(file: File, maxDim: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => blob
          ? resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
          : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export const AVATAR_GIF_MAX_BYTES = 3.75 * 1024 * 1024;

export async function publishAvatar(name: string, file: File): Promise<void> {
  const toUpload = file.type === 'image/gif' ? file : await resizeImage(file, 800, 0.85);
  await qdnRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: 'THUMBNAIL',
    identifier: 'avatar',
    name,
    data64: await fileToBase64(toUpload),
    filename: toUpload.name,
  });
}

export async function openInNewTab(address: string): Promise<void> {
  await qdnRequest({ action: 'OPEN_NEW_TAB', address });
}

export async function openDocumentViewer(service: string, name: string, identifier: string): Promise<void> {
  await qdnRequest({ action: 'OPEN_QDN_DOCUMENT_VIEWER', service, name, identifier });
}

export async function publishAvatarFromQDN(toName: string, fromName: string): Promise<void> {
  const b64 = await fetchResourceAsBase64('THUMBNAIL', fromName, 'avatar');
  await qdnRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: 'THUMBNAIL',
    identifier: 'avatar',
    name: toName,
    data64: b64,
    filename: 'avatar.jpg',
  });
}

export async function getList(listName: string): Promise<string[]> {
  try {
    const res = await qdnRequest({ action: 'GET_LIST', listName });
    return Array.isArray(res) ? (res as string[]) : [];
  } catch { return []; }
}

export async function addToList(listName: string, items: string[]): Promise<boolean> {
  const res = await qdnRequest({ action: 'ADD_TO_LIST', listName, items });
  return res === true;
}

export async function removeFromList(listName: string, items: string[]): Promise<boolean> {
  const res = await qdnRequest({ action: 'REMOVE_FROM_LIST', listName, items });
  return res === true;
}

export type ResourceProperties = {
  filename?: string;
  mimeType?: string;
  size?: number;
};

export async function fetchResourceProperties(
  service: string,
  name: string,
  identifier: string,
): Promise<ResourceProperties | null> {
  try {
    return await qdnRequest({
      action: 'GET_QDN_RESOURCE_PROPERTIES',
      service,
      name,
      identifier,
    }) as ResourceProperties;
  } catch { return null; }
}

export async function searchResources(opts: {
  service?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<QdnResource[]> {
  try {
    const res = await qdnRequest({
      action: 'SEARCH_QDN_RESOURCES',
      mode: 'LATEST',
      includeMetadata: true,
      limit: opts.limit ?? 20,
      offset: opts.offset ?? 0,
      reverse: true,
      ...(opts.service ? { service: opts.service } : {}),
      ...(opts.query   ? { query: opts.query }     : {}),
    }) as RawQdnResource[];
    return (res ?? []).map(normalizeResource);
  } catch { return []; }
}

export async function ensureAccountUnlocked(): Promise<boolean> {
  const result = await qdnRequest({ action: 'UNLOCK_SELECTED_ACCOUNT' }) as { isUnlocked?: boolean } | null;
  return result?.isUnlocked === true;
}

export type NotificationRule = {
  notificationId: string;
  event: string;
  filters: Record<string, boolean | number | string | string[]>;
  title?: string;
  text?: string;
  link?: string;
};

export async function supportsNotifications(): Promise<boolean> {
  try {
    const actions = await qdnRequest({ action: 'SHOW_ACTIONS' });
    return Array.isArray(actions) && actions.includes('NOTIFICATION_ADD');
  } catch { return false; }
}

export async function getNotificationRules(): Promise<NotificationRule[]> {
  try {
    const res = await qdnRequest({ action: 'NOTIFICATION_GET' });
    return Array.isArray(res) ? (res as NotificationRule[]) : [];
  } catch { return []; }
}

export async function addNotificationRule(rule: NotificationRule): Promise<void> {
  await qdnRequest({ action: 'NOTIFICATION_ADD', subscriptions: [rule] });
}

export async function removeNotificationRules(notificationIds?: string[]): Promise<void> {
  await qdnRequest({
    action: 'NOTIFICATION_REMOVE',
    ...(notificationIds ? { notificationIds } : {}),
  });
}
