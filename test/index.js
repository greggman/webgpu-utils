/* global mocha */
import './tests/generate-mipmap-test.js';
import './tests/texture-utils-test.js';
import './tests/webgpu-utils-test.js';

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
