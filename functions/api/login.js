import {
    badRequest,
    isSecureRequest,
    isValidStudentId,
    json,
    buildSessionCookie,
    serverError,
    sha256,
    signSession
} from './_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.DB || !env.SESSION_SECRET) {
        return serverError('Missing Cloudflare environment variables.');
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return badRequest('请求体必须是 JSON。');
    }

    const studentId = String(payload.studentId || '').trim();
    const password = String(payload.password || '');

    if (!isValidStudentId(studentId)) {
        return badRequest('请输入学号。');
    }

    if (password.length < 6) {
        return badRequest('密码长度至少需要 6 位。');
    }

    const passwordHash = await sha256(password);
    const student = await env.DB.prepare(
        'SELECT student_id, name, password_hash, status FROM students WHERE student_id = ?'
    ).bind(studentId).first();

    if (!student || student.status !== 'active' || passwordHash !== student.password_hash) {
        return json({ error: '学号或密码错误，请检查后重试。' }, { status: 401 });
    }

    const sessionToken = await signSession(studentId, env.SESSION_SECRET);
    const response = json({
        ok: true,
        studentId,
        name: student.name
    });
    response.headers.set('Set-Cookie', buildSessionCookie(sessionToken, isSecureRequest(request)));
    return response;
}
