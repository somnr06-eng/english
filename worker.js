import { onRequestPost as loginPost } from './functions/api/login.js';
import { onRequestPost as logoutPost } from './functions/api/logout.js';
import { onRequestGet as sessionGet } from './functions/api/session.js';
import { onRequestGet as dictationSessionGet } from './functions/api/dictation/session.js';
import { onRequestPost as dictationQuizPost } from './functions/api/dictation/quiz.js';
import { onRequestPost as dictationSubmitPost } from './functions/api/dictation/submit.js';
import { json } from './functions/api/_utils.js';

const routeHandlers = new Map([
    ['POST /api/login', loginPost],
    ['POST /api/logout', logoutPost],
    ['GET /api/session', sessionGet],
    ['GET /api/dictation/session', dictationSessionGet],
    ['POST /api/dictation/quiz', dictationQuizPost],
    ['POST /api/dictation/submit', dictationSubmitPost]
]);

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const routeKey = `${request.method.toUpperCase()} ${url.pathname}`;
        const handler = routeHandlers.get(routeKey);

        if (handler) {
            return handler({ request, env, ctx });
        }

        if (url.pathname.startsWith('/api/')) {
            return json({ error: 'Not found.' }, { status: 404 });
        }

        return env.ASSETS.fetch(request);
    }
};
