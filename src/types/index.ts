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

export const SERVICE_TYPES: ServiceTypeDef[] = [
  { value: 'ARBITRARY_DATA', label: 'Arbitrary Data' },
  { value: 'APP',            label: 'App',            maxSize: '50 MiB' },
  { value: 'ATTACHMENT',     label: 'Attachment',     maxSize: '50 MiB' },
  { value: 'AUDIO',          label: 'Audio' },
  { value: 'BLOG_POST',      label: 'Blog Post' },
  { value: 'DOCUMENT',       label: 'Document' },
  { value: 'GIF_REPOSITORY', label: 'GIF Repository', maxSize: '25 MiB' },
  { value: 'IMAGE',          label: 'Image',          maxSize: '10 MiB' },
  { value: 'JSON',           label: 'JSON',           maxSize: '25 KiB' },
  { value: 'METADATA',       label: 'Metadata' },
  { value: 'PLAYLIST',       label: 'Playlist' },
  { value: 'THUMBNAIL',      label: 'Thumbnail',      maxSize: '500 KiB' },
  { value: 'VIDEO',          label: 'Video' },
  { value: 'WEBSITE',        label: 'Website',        note: 'requires index.html' },
];
