import {
    clearSessionCookie,
    isSecureRequest,
    json
} from './_utils.js';

export async function onRequestPost(context) {
    const { request } = context;
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', clearSessionCookie(isSecureRequest(request)));
    return response;
}
