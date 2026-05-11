import {
    badRequest,
    createSessionToken,
    isSecureRequest,
    isValidStudentId,
    json,
    buildSessionCookie,
    serverError,
    sha256
} from './_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.DB) {
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

    const sessionToken = await createSessionToken(studentId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
        `INSERT INTO student_sessions (session_token, student_id, expires_at)
         VALUES (?, ?, ?)`
    ).bind(sessionToken, studentId, expiresAt).run();

    const response = json({
        ok: true,
        studentId,
        name: student.name
    });
    response.headers.set('Set-Cookie', buildSessionCookie(sessionToken, isSecureRequest(request)));
    return response;
}
