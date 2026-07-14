import jwt from 'jsonwebtoken';

export type InternalIdentityClaims = {
    typ: 'internal_identity';
    sub: string;
    workspaceId: string;
    workspaceRole: string;
    systemRole: string;
    permissions: string[];
    requestId: string;
    impersonating?: boolean;
};

export function signInternalIdentity(
    claims: InternalIdentityClaims,
    secret: string,
    audience: string,
) {
    return jwt.sign(claims, secret, {
        algorithm: 'HS256',
        issuer: 'api-gateway',
        audience,
        expiresIn: '60s',
        jwtid: `${claims.requestId}:${audience}`,
    });
}

export function verifyInternalIdentity(
    token: string,
    secret: string,
    audience: string,
): InternalIdentityClaims {
    const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'api-gateway',
        audience,
    }) as jwt.JwtPayload & InternalIdentityClaims;

    if (decoded.typ !== 'internal_identity' || !decoded.sub || !decoded.workspaceId || !decoded.requestId) {
        throw new Error('Invalid internal identity claims');
    }
    return decoded;
}

export function extractInternalIdentityToken(value?: string | null) {
    if (!value) return null;
    return value.startsWith('Bearer ') ? value.slice(7).trim() : value.trim();
}