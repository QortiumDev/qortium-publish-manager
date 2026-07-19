import { useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { accountAtom, notificationsEnabledAtom, notificationsSupportedAtom } from '../state/atoms';
import {
  supportsNotifications,
  getNotificationRules,
  addNotificationRule,
  removeNotificationRules,
} from '../api/qortal';

const NOTIFICATION_ID = 'own-resource-published';

function ruleMatchesName(rules: Awaited<ReturnType<typeof getNotificationRules>>, name: string): boolean {
  return rules.some(r =>
    r.notificationId === NOTIFICATION_ID &&
    Array.isArray(r.filters.names) &&
    r.filters.names.length === 1 &&
    r.filters.names[0] === name,
  );
}

export function useOwnPublishNotifications() {
  const account = useAtomValue(accountAtom);
  const enabled = useAtomValue(notificationsEnabledAtom);
  const [supported, setSupported] = useAtom(notificationsSupportedAtom);

  useEffect(() => {
    supportsNotifications().then(setSupported).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supported) return;
    const name = account?.name;

    if (!enabled || !name) {
      removeNotificationRules().catch(() => {});
      return;
    }

    getNotificationRules()
      .then(rules => {
        if (ruleMatchesName(rules, name)) return;
        return addNotificationRule({
          notificationId: NOTIFICATION_ID,
          event: 'RESOURCE_PUBLISHED',
          filters: { names: [name] },
          title: 'Your resource is now live',
        });
      })
      .catch(() => {});
  }, [supported, enabled, account?.name]);
}
