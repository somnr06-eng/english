import {
    badRequest,
    conflict,
    isPositiveDay,
    json,
    requireStudent,
    serverError,
    todayKey
} from '../_utils.js';

function normalizeItems(rawItems, day) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return null;
    }

    const items = [];
    for (const raw of rawItems) {
        const word = String(raw.word || '').trim();
        const definition = String(raw.definition || '').trim();
        const userInput = String(raw.userInput || '').trim();
        const sourceDay = isPositiveDay(raw.sourceDay) || day;
        const isReview = Boolean(raw.isReview);
        const isCorrect = Boolean(raw.isCorrect);

        if (!word || !definition) {
            return null;
        }

        items.push({
            word,
            definition,
            userInput,
            sourceDay,
            isReview,
            isCorrect
        });
    }

    return items;
}

export async function onRequestPost(context) {
    const auth = await requireStudent(context);
    if (auth.error) return auth.error;

    let payload;
    try {
        payload = await context.request.json();
    } catch {
        return badRequest('请求体必须是 JSON。');
    }

    const day = isPositiveDay(payload.day);
    const items = normalizeItems(payload.items, day);
    if (!day || !items) {
        return badRequest('提交数据无效。');
    }

    const attemptDate = todayKey();
    const existing = await context.env.DB.prepare(
        'SELECT id FROM dictation_attempts WHERE student_id = ? AND day_no = ? AND attempt_date = ?'
    ).bind(auth.student.studentId, day, attemptDate).first();

    if (existing) {
        return conflict('今天这个学习日已经提交过，不能重复提交。');
    }

    const totalCount = items.length;
    const correctCount = items.filter((item) => item.isCorrect).length;
    const reviewCount = items.filter((item) => item.isReview).length;
    const accuracy = Math.round((correctCount / totalCount) * 100);
    const completedAt = new Date().toISOString();

    try {
        const insertAttempt = await context.env.DB.prepare(
            `INSERT INTO dictation_attempts
             (student_id, day_no, attempt_date, total_count, correct_count, review_count, accuracy, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            auth.student.studentId,
            day,
            attemptDate,
            totalCount,
            correctCount,
            reviewCount,
            accuracy,
            completedAt
        ).run();

        const attemptId = insertAttempt.meta.last_row_id;

        for (const item of items) {
            await context.env.DB.prepare(
                `INSERT INTO dictation_attempt_items
                 (attempt_id, student_id, day_no, word, definition, source_day, is_review, is_correct, user_input, submitted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                attemptId,
                auth.student.studentId,
                day,
                item.word,
                item.definition,
                item.sourceDay,
                item.isReview ? 1 : 0,
                item.isCorrect ? 1 : 0,
                item.userInput,
                completedAt
            ).run();

            if (item.isCorrect) {
                await context.env.DB.prepare(
                    `UPDATE student_wrong_words
                     SET is_active = 0,
                         last_correct_at = ?
                     WHERE student_id = ? AND word = ?`
                ).bind(
                    completedAt,
                    auth.student.studentId,
                    item.word
                ).run();
            } else {
                await context.env.DB.prepare(
                    `INSERT INTO student_wrong_words
                     (student_id, word, definition, source_day, is_active, first_wrong_at, last_wrong_at, last_correct_at, wrong_count)
                     VALUES (?, ?, ?, ?, 1, ?, ?, NULL, 1)
                     ON CONFLICT(student_id, word) DO UPDATE SET
                        definition = excluded.definition,
                        source_day = excluded.source_day,
                        is_active = 1,
                        last_wrong_at = excluded.last_wrong_at,
                        last_correct_at = NULL,
                        wrong_count = student_wrong_words.wrong_count + 1`
                ).bind(
                    auth.student.studentId,
                    item.word,
                    item.definition,
                    item.sourceDay,
                    completedAt,
                    completedAt
                ).run();
            }
        }
    } catch (error) {
        return serverError(`提交写库失败: ${error?.message || String(error)}`);
    }

    return json({
        ok: true,
        summary: {
            day,
            attemptDate,
            totalCount,
            correctCount,
            reviewCount,
            accuracy,
            completedAt
        }
    });
}
