import { get, post, del } from './client';

export const generateAnswerBotFAQs = async (data) => post('/automation/answerbot/generate', data);
export const getAnswerBotFAQs = async () => get('/automation/answerbot/faqs');
export const approveAnswerBotFAQs = async (ids) => post('/automation/answerbot/approve', { ids });
export const deleteAnswerBotFAQ = async (id) => del(`/automation/answerbot/faqs/${id}`);
export const getAnswerBotSources = async () => get('/automation/answerbot/sources');
