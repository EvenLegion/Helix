type Info = { channelId: string; messageId: string; threadId?: string };

const bySession = new Map<number, Info>();

export function setNotifyInfo(sessionId: number, info: Info) {
    bySession.set(sessionId, info);
}

export function getNotifyInfo(sessionId: number): Info | undefined {
    return bySession.get(sessionId);
}

export function clearNotifyInfo(sessionId: number) {
    bySession.delete(sessionId);
}
