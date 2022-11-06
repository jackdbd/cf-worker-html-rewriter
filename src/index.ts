import type { Env, FallbackParams } from "./interfaces.js";

// We can either define a class...
class styleTagAppender implements HTMLRewriterElementContentHandlers {
  private css: string;

  constructor(css: string) {
    this.css = css;
  }

  element(el: Element) {
    console.log(`appending ct.css in ${el.tagName} using a <style> tag`);
    el.append(`<style>${this.css}</style>`, { html: true });
  }
}

// ...or a factory function
const makeStyleTagAppender = (
  css: string
): HTMLRewriterElementContentHandlers => {
  return {
    element: (el: Element) => {
      console.log(`appending ct.css in ${el.tagName} using a <style> tag`);
      el.append(`<style>${css}</style>`, { html: true });
    },
  };
};

async function fetchAndTransformResponse(url: string, css: string) {
  // A request is immutable, so if we want to fetch a new URL we have to create
  // a new request.
  // We could also just use fetch('some URL') instead of manually creating a Request.
  // https://developers.cloudflare.com/workers/examples/respond-with-another-site/
  // See also here for an alternative way of creating a new request.
  // https://github.com/pmeenan/cf-workers/blob/8938c2d62353d4c7bc49b729815bd400552cc524/cache-bypass-on-cookie/cache-bypass-on-cookie.js#L30
  const req = new Request(url, {
    method: "GET",
  });

  const originalResponse = await fetch(req);

  const selector = "head";
  console.log(
    `transform response from ${req.url} when HTML matches selector ${selector}`
  );

  // TODO: rewrite links
  // https://developers.cloudflare.com/workers/examples/rewrite-links/

  // Should we strip the CSP header?
  // const headersToStrip = new Set(["content-security-policy"]);

  //   const headers: [key: string, val: string][] = [];
  //   for (const [key, val] of originalResponse.headers.entries()) {
  //     if (headersToStrip.has(key)) {
  //       console.log(`=== strip header ${key} ===`);
  //     } else {
  //       headers.push([key, val]);
  //     }
  //   }

  //   const res = new Response(originalResponse.body, {
  //     status: originalResponse.status,
  //     statusText: originalResponse.statusText,
  //     headers: new Headers(headers),
  //   });

  // https://developers.cloudflare.com/workers/examples/security-headers/

  return (
    new HTMLRewriter()
      .on(selector, makeStyleTagAppender(css))
      //   .on(selector, new styleTagAppender(css))
      .transform(originalResponse)
  );
}

const fallbackResponse = ({
  title,
  instructions,
  errorMessage,
  contentType,
}: FallbackParams) => {
  switch (contentType) {
    case "application/json;charset=UTF-8": {
      const obj = { title, instructions, errorMessage };
      return new Response(JSON.stringify(obj), {
        headers: {
          "content-type": contentType,
        },
      });
    }

    default: {
      // auto-style the page with some nice defaults and typography
      // https://watercss.kognise.dev/
      const html = `
<!DOCTYPE html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
  <style>
    li:after { content: ""; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <h2>Instructions:</h2>
  <ol>${instructions.map((s) => `<li>${s}</li>`).join("")}</ol>
  ${errorMessage && `<h2>Error:</h2><p>${errorMessage}</p>`}
</body>`;

      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
  }
};

/**
 * Fetches the ct.css stylesheet from GitHub.
 *
 * In alternative we could copy the css in a JS/TS file, and import it with:
 * import { css } from "./ct.css.js"
 */
const ctCss = async () => {
  const res = await fetch(
    "https://raw.githubusercontent.com/csswizardry/ct/master/ct.css"
  );

  return await res.text();
};

/**
 * Handles the Cloudflare Workers [Fetch Event](https://developers.cloudflare.com/workers/runtime-apis/fetch-event/).
 */
const handleFetch = async (
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> => {
  const key = env.QUERY_STRING_KEY;
  const qs = new URL(request.url).searchParams;

  const { cf } = request;
  if (cf) {
    const { city, country } = cf as any;
    console.log(`Request came from city: ${city} in country: ${country}`);
  }

  const title = `Cloudflare Worker inject ct.css in head`;
  const instructions = [
    '<p>Copy the URL you want to test with <a href="https://github.com/csswizardry/ct" target="_blank" rel="noopener">ct.css</a>.</p>',
    `<p>Paste the URL in the query string. For example: <code>?${key}=https://github.com/csswizardry/ct</code>.</p>`,
  ];

  const contentType = "text/html;charset=UTF-8";
  //   const contentType = "application/json;charset=UTF-8";

  const value = qs.get(key);
  if (!value) {
    return fallbackResponse({
      title,
      instructions,
      errorMessage: `Key ${key} not found in query string`,
      contentType,
    });
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch (err: any) {
    return fallbackResponse({
      title,
      instructions,
      errorMessage: `${err.message} String "${value}" does not seem a valid URL.`,
      contentType,
    });
  }

  const css = await ctCss();

  // We are still not sure whether the URL we are trying to test is valid, so
  // the Cloudflare Worker could still throw an exception when trying to fetch
  // it. To avoid errors, we can either use ctx.passThroughOnException() and let
  // Cloudflare display the default page for Cloudflare Workers, or handle the
  // exception manually and return a fallback response.

  try {
    return await fetchAndTransformResponse(url.toString(), css);
  } catch (err: any) {
    return fallbackResponse({
      title,
      instructions,
      errorMessage: err.message,
      contentType,
    });
  }
};

export default {
  fetch: handleFetch,
};
