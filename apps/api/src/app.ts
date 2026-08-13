import { API_VERSION } from '@crossval/shared';
import express from 'express';

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: API_VERSION });
});

export default app;
