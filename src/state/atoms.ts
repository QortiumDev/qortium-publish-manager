import { atom } from 'jotai';
import { EnumTheme } from '../types';

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
