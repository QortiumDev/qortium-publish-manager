import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { EnumTheme, type PublishSource } from '../types';

export type UiStyle = 'classic' | 'modern';

const UI_STYLES = new Set<UiStyle>(['classic', 'modern']);
const _p = new URLSearchParams(window.location.search);
const _theme = _p.get('theme') === 'light' ? EnumTheme.LIGHT : EnumTheme.DARK;
const _accent = _p.get('accent') ?? 'green';
const _textSize = _p.get('textSize') ?? 'medium';
const _lang = _p.get('lang') ?? 'en';
const _uiStyle = parseUiStyle(_p.get('uiStyle'));

export function parseUiStyle(value: string | null): UiStyle {
  return value && UI_STYLES.has(value as UiStyle) ? (value as UiStyle) : 'classic';
}

document.documentElement.dataset.theme = _theme;
document.documentElement.dataset.accent = _accent;
document.documentElement.dataset.textSize = _textSize;
document.documentElement.dataset.ui = _uiStyle;
document.documentElement.lang = _lang;
document.documentElement.dir = _lang === 'ar' || _lang === 'he' ? 'rtl' : 'ltr';
document.documentElement.style.colorScheme = _theme;

export const themeAtom = atom<EnumTheme>(_theme);
export const accentAtom = atom<string>(_accent);
export const uiStyleAtom = atom<UiStyle>(_uiStyle);
export const accountAtom = atom<{ address: string; name: string | null } | null>(null);

// QDN pattern-based block / follow lists (loaded once from bridge, then kept in sync)
export const blockedQdnAtom      = atom<string[]>([]);
export const followedQdnAtom     = atom<string[]>([]);
export const qdnListsLoadedAtom  = atom<boolean>(false);

// Publish dialog draft - lives outside the component so a half-filled form
// survives closing the dialog or navigating between pages (in-memory only,
// cleared on app reload since File objects cannot be persisted)
export const publishServiceAtom      = atom<string>('ARBITRARY_DATA');
export const publishSourceAtom       = atom<PublishSource | null>(null);
export const publishIdentifierAtom   = atom<string>('');
export const publishTitleAtom        = atom<string>('');
export const publishDescriptionAtom  = atom<string>('');
export const publishTagsInputAtom    = atom<string>('');
export const publishMultiFileZipAtom = atom<boolean>(false);

// Background "your resource is live" notifications (own name, RESOURCE_PUBLISHED).
// notificationsSupportedAtom is set once after a SHOW_ACTIONS feature check;
// notificationsEnabledAtom is the user's local on/off preference.
export const notificationsSupportedAtom = atom<boolean>(false);
export const notificationsEnabledAtom = atomWithStorage<boolean>('publish-own-notifications-enabled', true);
