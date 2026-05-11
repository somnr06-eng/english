import {
    clearSessionCookie,
    isSecureRequest,
    json,
    parseCookies
} from './_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const cookies = parseCookies(request);
    if (env.DB && cookies.session) {
        await env.DB.prepare(
            'DELETE FROM student_sessions WHERE session_token = ?'
        ).bind(cookies.session).run().catch(() => {});
    }
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', clearSessionCookie(isSecureRequest(request)));
    return response;
}
