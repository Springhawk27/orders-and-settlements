const SWAGGER_UI_VERSION = '5.32.13';

export const DOCS_CDN_ORIGIN = 'https://cdn.jsdelivr.net';

const assets = `${DOCS_CDN_ORIGIN}/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

export const docsPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Orders and Settlements API</title>
    <link rel="stylesheet" href="${assets}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${assets}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
    <script src="/api/docs/init.js"></script>
  </body>
</html>
`;

export const docsInitScript = `SwaggerUIBundle({
  url: '/api/docs.json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  displayRequestDuration: true,
  withCredentials: true,
});
`;
