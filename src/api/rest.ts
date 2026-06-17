async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchNameInfo(name: string): Promise<{ name: string; owner: string } | null> {
  try { return await get<{ name: string; owner: string }>(`/names/${name}`); }
  catch { return null; }
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
    return await get<ResourceProperties>(
      `/arbitrary/resource/properties/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`,
    );
  } catch { return null; }
}
