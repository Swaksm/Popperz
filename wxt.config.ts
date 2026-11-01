import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const RULESETS = ['popunder', 'easylist', 'easyprivacy'];

export default defineConfig({
  hooks: {
    // The GPL text must travel with every copy of the extension.
    'build:publicAssets': (_, files) => {
      files.push({ absoluteSrc: resolve('LICENSE'), relativeDest: 'LICENSE' });
    },
  },
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'fr',
    action: { default_title: '__MSG_extName__' },
    permissions: [
      'storage', 'scripting', 'webNavigation', 'tabs',
      'declarativeNetRequest', 'declarativeNetRequestFeedback',
    ],
    host_permissions: ['<all_urls>'],
    declarative_net_request: {
      rule_resources: RULESETS.map((id) => ({ id, enabled: true, path: `rules/${id}.json` })),
    },
  },
});
