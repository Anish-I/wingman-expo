import { Alert, Platform } from 'react-native';

/**
 * Cross-platform confirm dialog that actually works on web.
 *
 * react-native-web's `Alert.alert` ignores the buttons array — it renders (at
 * most) the title/message and never calls a button's onPress, so any confirm
 * built on it silently does nothing on web. This bridges to the browser's native
 * `window.confirm` on web and to `Alert.alert` on iOS/Android, returning a
 * promise that resolves true only when the user confirms.
 */
export function confirmAction(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const {
    title,
    message = '',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    destructive = false,
  } = options;

  if (Platform.OS === 'web') {
    const w = globalThis as { confirm?: (msg?: string) => boolean };
    if (typeof w.confirm !== 'function') return Promise.resolve(true);
    return Promise.resolve(w.confirm(message ? `${title}\n\n${message}` : title));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * Single-button informational alert that also works on web. Same RNW caveat as
 * above — a plain `Alert.alert(title, message)` is unreliable on web — so this
 * routes to the browser's `window.alert` on web and `Alert.alert` on native.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    const w = globalThis as { alert?: (msg?: string) => void };
    if (typeof w.alert === 'function') w.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
