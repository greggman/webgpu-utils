/* global mocha */
import './tests/buffer-views-test.js';
import './tests/data-definition-test.js';
import './tests/generate-mipmap-test.js';
import './tests/attribute-utils-test.js';
import './tests/texture-utils-test.js';

const settings = typeof window === 'undefined' ? {} : Object.fromEntries(new URLSearchParams(window.location.search).entries());
if (settings.reporter) {
  mocha.reporter(settings.reporter);
}
if (settings.grep) {
  mocha.grep(new RegExp(settings.grep, 'i'), false);
}

mocha.run((failures) => {
  window.testsPromiseInfo.resolve(failures);
});
