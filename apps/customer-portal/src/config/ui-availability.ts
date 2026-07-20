const FROZEN_CHANNELS = new Set(['instagram', 'sms', 'rcs']);

export function isChannelVisible(channel?: string | null) {
  return !channel || !FROZEN_CHANNELS.has(channel.toLowerCase());
}

export function isFrozenUiRoute(pathname: string) {
  return pathname.startsWith('/automation/instagram-quickflows');
}
