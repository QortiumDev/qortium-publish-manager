import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeAtom, accentAtom } from '../state/atoms';
import { EnumTheme } from '../types';
import { useSetAtom } from 'jotai';

export type TextSize = 'extra-large' | 'extra-small' | 'huge' | 'large' | 'medium' | 'small';

const SUPPORTED_TEXT_SIZES: readonly TextSize[] = [
  'extra-small', 'small', 'medium', 'large', 'extra-large', 'huge',
];

type BridgeMessageData = {
  action?: unknown;
  accent?: unknown;
  language?: unknown;
  path?: unknown;
  textSize?: unknown;
  theme?: unknown;
};

export function isSupportedTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && SUPPORTED_TEXT_SIZES.includes(value as TextSize);
}

export function applyTextSize(value: unknown, root: HTMLElement = document.documentElement) {
  if (!isSupportedTextSize(value)) return;
  root.dataset.textSize = value;
}

function isBridgeMessageData(value: unknown): value is BridgeMessageData {
  return typeof value === 'object' && value !== null;
}

export function isTrustedBridgeMessage(event: MessageEvent<unknown>) {
  return event.source === window.parent || event.source === window;
}

export function isSafeNavigationPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  if (!path) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('//');
}

export function getNavigationReplyTargetOrigin(event: MessageEvent<unknown>) {
  if (!event.origin || event.origin === 'null') return null;
  return event.origin;
}

export const useIframe = () => {
  const setTheme = useSetAtom(themeAtom);
  const setAccent = useSetAtom(accentAtom);
  const navigate = useNavigate();

  useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      if (!isTrustedBridgeMessage(event) || !isBridgeMessageData(event.data)) return;

      const data = event.data;

      if (data.action === 'NAVIGATE_TO_PATH' && isSafeNavigationPath(data.path)) {
        navigate(data.path);
        const replyOrigin = getNavigationReplyTargetOrigin(event);
        if (replyOrigin) {
          window.parent.postMessage({ action: 'NAVIGATION_SUCCESS', path: data.path }, replyOrigin);
        }
      } else if (data.action === 'THEME_CHANGED') {
        if (data.theme === 'dark') {
          setTheme(EnumTheme.DARK);
          document.documentElement.dataset.theme = 'dark';
          document.documentElement.style.colorScheme = 'dark';
        } else if (data.theme === 'light') {
          setTheme(EnumTheme.LIGHT);
          document.documentElement.dataset.theme = 'light';
          document.documentElement.style.colorScheme = 'light';
        }
      } else if (data.action === 'ACCENT_CHANGED' && typeof data.accent === 'string') {
        setAccent(data.accent);
      } else if (data.action === 'TEXT_SIZE_CHANGED') {
        applyTextSize(data.textSize);
      } else if (data.action === 'LANGUAGE_CHANGED' && typeof data.language === 'string') {
        document.documentElement.lang = data.language;
        document.documentElement.dir = data.language === 'ar' || data.language === 'he' ? 'rtl' : 'ltr';
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, setTheme, setAccent]);
};
