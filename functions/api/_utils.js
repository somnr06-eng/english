const encoder = new TextEncoder();

export function json(data, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {
        ...init,
        headers
    });
}

export function unauthorized(message = 'Unauthorized') {
    return json({ error: message }, { status: 401 });
}

export function badRequest(message = 'Bad request') {
    return json({ error: message }, { status: 400 });
}

export function serverError(message = 'Internal server error') {
    return json({ error: message }, { status: 500 });
}

export function conflict(message = 'Conflict') {
    return json({ error: message }, { status: 409 });
}

export function isValidStudentId(studentId) {
    return String(studentId || '').trim().length > 0;
}

export function isPositiveDay(value) {
    const day = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(day) && day >= 1 && day <= 30 ? day : null;
}

function toBase64Url(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256(input) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
    return toBase64Url(digest);
}

export function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

export function parseCookies(request) {
    const cookieHeader = request.headers.get('cookie') || '';
    return cookieHeader.split(';').reduce((acc, part) => {
        const [rawKey, ...rawValue] = part.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(rawValue.join('=') || '');
        return acc;
    }, {});
}

export async function signSession(studentId, secret) {
    const signature = await sha256(`${studentId}.${secret}`);
    return `${studentId}.${signature}`;
}

export async function verifySession(token, secret) {
    if (!token || !token.includes('.')) return null;
    const dotIndex = token.indexOf('.');
    const studentId = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);
    if (!studentId || !signature) return null;
    const expected = await sha256(`${studentId}.${secret}`);
    return expected === signature ? studentId : null;
}

export async function createSessionToken(studentId) {
    const entropy = `${studentId}.${Date.now()}.${crypto.randomUUID()}`;
    return sha256(entropy);
}

export async function diagnoseSessionToken(token, secret) {
    if (!token) {
        return { ok: false, reason: 'missing_cookie' };
    }
    if (!token.includes('.')) {
        return { ok: false, reason: 'invalid_cookie_format' };
    }

    const dotIndex = token.indexOf('.');
    const studentId = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);

    if (!studentId || !signature) {
        return { ok: false, reason: 'invalid_cookie_format' };
    }

    const expected = await sha256(`${studentId}.${secret}`);
    if (expected !== signature) {
        return { ok: false, reason: 'signature_mismatch', studentId };
    }

    return { ok: true, studentId };
}

export async function requireStudent(context) {
    const { request, env } = context;
    if (!env.DB) {
        return { error: serverError('D1 database is not configured.') };
    }
    const cookies = parseCookies(request);
    const sessionToken = cookies.session;
    if (!sessionToken) {
        return { error: unauthorized('Not logged in: missing_cookie.') };
    }

    const sessionRow = await env.DB.prepare(
        `SELECT session_token, student_id, expires_at
         FROM student_sessions
         WHERE session_token = ?`
    ).bind(sessionToken).first();

    if (!sessionRow) {
        return { error: unauthorized('Not logged in: session_not_found.') };
    }

    if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
        await env.DB.prepare(
            'DELETE FROM student_sessions WHERE session_token = ?'
        ).bind(sessionToken).run().catch(() => {});
        return { error: unauthorized('Not logged in: session_expired.') };
    }

    const result = await env.DB.prepare(
        'SELECT student_id, name, status FROM students WHERE student_id = ?'
    ).bind(sessionRow.student_id).first();

    if (!result || result.status !== 'active') {
        return { error: unauthorized('Student account is unavailable.') };
    }

    return {
        student: {
            studentId: result.student_id,
            name: result.name
        }
    };
}

export function buildSessionCookie(token, secure = true) {
    const attrs = [
        `session=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=604800'
    ];
    if (secure) attrs.push('Secure');
    return attrs.join('; ');
}

export function clearSessionCookie(secure = true) {
    const attrs = [
        'session=',
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0'
    ];
    if (secure) attrs.push('Secure');
    return attrs.join('; ');
}

export function isSecureRequest(request) {
    const proto = request.headers.get('x-forwarded-proto');
    if (proto) return proto === 'https';
    return new URL(request.url).protocol === 'https:';
}
