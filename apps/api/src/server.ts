import app from './app';

const port = Number(process.env.PORT ?? 5000);

app.listen(port, () => {
  process.stdout.write(`api listening on http://localhost:${port}\n`);
});
