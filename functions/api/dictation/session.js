import {
    badRequest,
    isPositiveDay,
    json,
    requireStudent,
    todayKey
} from '../_utils.js';

function buildSummary(row) {
    if (!row) return null;
    return {
        attemptId: row.id,
        day: row.day_no,
        attemptDate: row.attempt_date,
        totalCount: row.total_count,
        correctCount: row.correct_count,
        reviewCount: row.review_count,
        accuracy: row.accuracy,
        completedAt: row.completed_at
    };
}

export async function onRequestGet(context) {
    const auth = await requireStudent(context);
    if (auth.error) return auth.error;

    const url = new URL(context.request.url);
    const day = isPositiveDay(url.searchParams.get('day'));
    if (!day) {
        return badRequest('day 参数无效。');
    }

    const attemptDate = todayKey();
    const row = await context.env.DB.prepare(
        `SELECT id, day_no, attempt_date, total_count, correct_count, review_count, accuracy, completed_at
         FROM dictation_attempts
         WHERE student_id = ? AND day_no = ? AND attempt_date = ?`
    ).bind(auth.student.studentId, day, attemptDate).first();

    return json({
        ok: true,
        day,
        studentId: auth.student.studentId,
        completed: Boolean(row),
        summary: buildSummary(row)
    });
}
