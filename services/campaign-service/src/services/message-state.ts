export const MESSAGE_STATE_ORDER: Record<string, number> = {
    pending: 0,
    queued: 1,
    dispatching: 2,
    accepted: 3,
    sent: 4,
    delivered: 5,
    read: 6,
};

export function canTransitionMessageState(from: string, to: string) {
    if (from === to) return false;
    if (['failed', 'rejected', 'expired', 'unknown', 'reconciliation_required'].includes(to)) {
        return !['read', 'failed', 'rejected', 'expired'].includes(from);
    }
    if (!(from in MESSAGE_STATE_ORDER) || !(to in MESSAGE_STATE_ORDER)) return false;
    return MESSAGE_STATE_ORDER[to] > MESSAGE_STATE_ORDER[from];
}