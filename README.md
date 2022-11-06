# CF worker HTML rewriter

Live: https://cf-worker-html-rewriter-production.jackdebidda.workers.dev/?url-to-test=https://github.com/csswizardry/ct

## Develop

Develop the worker.

```sh
npx wrangler dev src/index.ts
# or
npm run dev
```

## Deploy

Publish the worker.

```sh
npx wrangler publish src/index.ts --env production
# or
npm run deploy:prod
```

## Debug

Stream the logs coming from the worker deployed to the production environment.

```sh
wrangler tail --format pretty --env production
# or
npm run logs:prod
```
