// Vercel executes Functions as native ESM. Use the emitted JavaScript extension
// so its function bundler includes and resolves the sibling TypeScript module.
import { createApp } from '../app.js';

// تابع سرورلس Vercel: کل اندپوینت‌های /api/* توسط همین Express app سرو می‌شوند
const app = createApp();

export default app;
