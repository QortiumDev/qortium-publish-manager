import type { QdnResource } from '../types';

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
    }) as QdnResource[];
    return res ?? [];
  } catch { return []; }
}

export async function publishResource(opts: {
  service: string;
  file: File;
  identifier: string;
  title?: string;
  description?: string;
  tags?: string[];
  isMultiFileZip?: boolean;
}): Promise<void> {
  await qdnRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: opts.service,
    name: (await qdnRequest({ action: 'GET_SELECTED_ACCOUNT' }) as { name: string | null }).name ?? '',
    identifier: opts.identifier,
    data64: await fileToBase64(opts.file),
    filename: opts.file.name,
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
    }) as QdnResource[];
    return res ?? [];
  } catch { return []; }
}
