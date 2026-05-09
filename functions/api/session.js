import {
    json,
    requireStudent
} from './_utils.js';

export async function onRequestGet(context) {
    const auth = await requireStudent(context);
    if (auth.error) {
        return auth.error;
    }

    return json({
        authenticated: true,
        studentId: auth.student.studentId,
        name: auth.student.name
    });
}
