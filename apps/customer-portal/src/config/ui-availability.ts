const REMOVED_CHANNELS = new Set(['instagram', 'sms', 'rcs', 'email']);

export function isChannelVisible(channel?: string | null) {
    return !channel || !REMOVED_CHANNELS.has(channel.toLowerCase());
}
