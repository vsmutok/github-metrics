// Serverless entry point for Vercel — forwards every /api/* request to the
// Express app. The catch-all route preserves the original path.
import app from '../src/app.js';

export default app;
