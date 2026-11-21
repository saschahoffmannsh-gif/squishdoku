// Hook for a future native shell (Capacitor): real Taptic Engine haptics on iPhone, where web
// navigator.vibrate does not exist. src/haptics.mjs calls window.SquishNative.haptic(kind) when present.
// Install in the native build: npm i @capacitor/haptics, then import this file once at startup.
//   kind: 'tap' | 'pop' | 'light' | 'wrong' | 'win' | 'undo'
export async function installNativeHaptics() {
  const cap = globalThis.Capacitor;
  if (!cap?.isNativePlatform?.()) return false;
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
  const play = {
    tap: () => Haptics.impact({ style: ImpactStyle.Light }),
    undo: () => Haptics.impact({ style: ImpactStyle.Light }),
    pop: () => Haptics.impact({ style: ImpactStyle.Medium }),
    light: () => Haptics.notification({ type: NotificationType.Success }),
    wrong: () => Haptics.notification({ type: NotificationType.Error }),
    win: () => Haptics.notification({ type: NotificationType.Success }),
  };
  globalThis.SquishNative = { ...(globalThis.SquishNative || {}), haptic: kind => play[kind]?.() };
  return true;
}
