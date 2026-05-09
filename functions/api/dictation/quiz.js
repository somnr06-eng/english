import {
    badRequest,
    conflict,
    isPositiveDay,
    json,
    requireStudent,
    todayKey
} from '../_utils.js';

function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function uniqueByWord(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const key = String(item.word || '').toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }
    return result;
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
    const daysPlan = Array.isArray(payload.daysPlan) ? payload.daysPlan : null;

    if (!day || !daysPlan || daysPlan.length < 30) {
        return badRequest('题库数据或 day 参数无效。');
    }

    const attemptDate = todayKey();
    const existing = await context.env.DB.prepare(
        'SELECT id FROM dictation_attempts WHERE student_id = ? AND day_no = ? AND attempt_date = ?'
    ).bind(auth.student.studentId, day, attemptDate).first();

    if (existing) {
        return conflict('今天这个学习日已经完成，不能重复开始。');
    }

    const newWords = Array.isArray(daysPlan[day - 1]) ? daysPlan[day - 1] : [];
    if (day === 1) {
        return json({
            ok: true,
            day,
            reviewCount: 0,
            words: shuffle(newWords.map((item) => ({
                ...item,
                isReview: false
            })))
        });
    }

    const previousWords = uniqueByWord(
        daysPlan.slice(0, day - 1).flatMap((group, index) =>
            (group || []).map((item) => ({
                word: item.word,
                definition: item.definition,
                sourceDay: index + 1
            }))
        )
    );

    const newWordSet = new Set(newWords.map((item) => item.word.toLowerCase()));

    const wrongRows = await context.env.DB.prepare(
        `SELECT word, definition, source_day
         FROM student_wrong_words
         WHERE student_id = ?`
    ).bind(auth.student.studentId).all();

    const wrongCandidates = uniqueByWord((wrongRows.results || []).map((row) => ({
        word: row.word,
        definition: row.definition,
        sourceDay: row.source_day
    }))).filter((item) => item.sourceDay < day && !newWordSet.has(item.word.toLowerCase()));

    const selectedWrong = shuffle(wrongCandidates).slice(0, 20);
    const selectedWrongSet = new Set(selectedWrong.map((item) => item.word.toLowerCase()));

    const fillerPool = previousWords.filter((item) => {
        const key = item.word.toLowerCase();
        return !newWordSet.has(key) && !selectedWrongSet.has(key);
    });

    const fillerNeeded = Math.max(0, 20 - selectedWrong.length);
    const fillerWords = shuffle(fillerPool).slice(0, fillerNeeded);

    const reviewWords = [
        ...selectedWrong.map((item) => ({ ...item, isReview: true })),
        ...fillerWords.map((item) => ({ ...item, isReview: true }))
    ];

    const finalWords = shuffle([
        ...newWords.map((item) => ({
            word: item.word,
            definition: item.definition,
            sourceDay: day,
            isReview: false
        })),
        ...reviewWords
    ]);

    return json({
        ok: true,
        day,
        reviewCount: reviewWords.length,
        words: finalWords
    });
}
