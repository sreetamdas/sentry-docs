/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import React from 'react';

import PageContext from 'sentry-docs/components/pageContext';

const sentryEnvironment = process.env.GATSBY_ENV || process.env.NODE_ENV || 'development';
const sentryLoaderUrl = process.env.SENTRY_LOADER_URL;

export const wrapPageElement = ({element, props: {pageContext}}) => (
  <PageContext.Provider value={pageContext}>{element}</PageContext.Provider>
);

export const onPreRenderHTML = ({getHeadComponents}) => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  getHeadComponents().forEach(el => {
    // Remove inline css. https://github.com/gatsbyjs/gatsby/issues/1526
    if (el.type === 'style') {
      el.type = 'link';
      el.props.href = el.props['data-href'];
      el.props.rel = 'stylesheet';
      el.props.type = 'text/css';

      delete el.props['data-href'];
      delete el.props.dangerouslySetInnerHTML;
      delete el.props.children;
    }
  });
};

function SentryLoaderScript() {
  return (
    <script key="sentry-loader-script" src={sentryLoaderUrl} crossOrigin="anonymous" />
  );
}

function SentryLoaderConfig() {
  return (
    <script
      key="sentry-loader-config"
      dangerouslySetInnerHTML={{
        __html: `
Sentry.onLoad(function() {
  Sentry.init({
    integrations: [
      new Sentry.Replay({
        unmask: ['.hover-card-link'],
      }),
    ],
    tracesSampleRate: ${sentryEnvironment === 'development' ? 0 : 1},
    replaysSessionSampleRate: ${sentryEnvironment === 'development' ? 0 : 0.1},
    replaysOnErrorSampleRate: ${sentryEnvironment === 'development' ? 0 : 1},
  });
});`,
      }}
    />
  );
}

export const onRenderBody = ({setHeadComponents}) => {
  // Sentry SDK setup
  if (sentryLoaderUrl) {
    setHeadComponents([SentryLoaderScript(), SentryLoaderConfig()]);
  }

  setHeadComponents([
    // Set up the data layer, enable privacy defaults
    <script
      key="gtm-data-layer"
      type="text/javascript"
      dangerouslySetInnerHTML={{
        __html: `
          (function(w, l) {
            w[l] = w[l] || [];
            if(/in-app/.test(window.location.pathname)){
              w[l].push({ 'disableDrift': 'true' })
            }
            w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
          })(window, 'dataLayer');
        `,
      }}
    />,
    // Fetch Tag Manager
    <script
      key="gtm-script"
      src="https://www.googletagmanager.com/gtm.js?id=GTM-N72TJRH"
      async
    />,
  ]);
};
