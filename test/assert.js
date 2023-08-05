export const config = {};

export function setConfig(options) {
  Object.assign(config, options);
}

function formatMsg(msg) {
  return `${msg}${msg ? ': ' : ''}`;
}

export function assertTruthy(actual, msg = '') {
  if (!actual) {
    throw new Error(`${formatMsg(msg)}expected: truthy, actual: ${actual}`);
  }
}

export function assertFalsy(actual, msg = '') {
  if (actual) {
    throw new Error(`${formatMsg(msg)}expected: falsy, actual: ${actual}`);
  }
}

export function assertStringMatchesRegEx(actual, regex, msg = '') {
  if (!regex.test(actual)) {
    throw new Error(`${formatMsg(msg)}expected: ${regex}, actual: ${actual}`);
  }
}

export function assertLessThan(actual, expected, msg = '') {
  if (actual >= expected) {
    throw new Error(`${formatMsg(msg)}expected: ${actual} to be less than: ${expected}`);
  }
}

export function assertEqualApproximately(actual, expected, range = 0.0000001, msg = '') {
  const diff = Math.abs(actual - expected);
  if (diff > range) {
    throw new Error(`${formatMsg(msg)}expected: ${actual} to be less ${range} different than: ${expected}`);
  }
}

export function assertInstanceOf(actual, expectedType, msg = '') {
  if (!(actual instanceof expectedType)) {
    throw new Error(`${formatMsg(msg)}expected: ${actual} to be of type: ${expectedType.constructor.name}`);
  }
}

export function assertIsArray(actual, msg = '') {
  if (!Array.isArray(actual)) {
    throw new Error(`${formatMsg(msg)}expected: ${actual} to be an Array`);
  }
}

export function assertEqual(actual, expected, msg = '') {
  // I'm sure this is not sufficient
  if (Array.isArray(actual) || isTypedArray(actual)) {
    assertArrayEqual(actual, expected);
  } else if (actual !== expected) {
    throw new Error(`${formatMsg(msg)}expected: ${expected} to equal actual: ${actual}`);
  }
}

const isTypedArray = (arr) =>
  arr && typeof arr.length === 'number' && arr.buffer instanceof ArrayBuffer && typeof arr.byteLength === 'number';

export function assertDeepEqual(actual, expected, msg = '') {
  if (Array.isArray(actual) || isTypedArray(actual)) {
    assertArrayEqual(actual, expected, msg);
  } else if (typeof actual === 'object') {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    assertArrayEqual(actualKeys, expectedKeys, msg);
    for (const key of actualKeys) {
      assertDeepEqual(actual[key], expected[key], `${msg} .${key}`);
    }
  } else {
    assertEqual(actual, expected, msg);
  }
}

export function assertStrictEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${formatMsg(msg)}expected: ${expected} to equal actual: ${actual}`);
  }
}

export function assertNotEqual(actual, expected, msg = '') {
  if (actual === expected) {
    throw new Error(`${formatMsg(msg)}expected: ${expected} to not equal actual: ${actual}`);
  }
}

export function assertStrictNotEqual(actual, expected, msg = '') {
  if (actual === expected) {
    throw new Error(`${formatMsg(msg)}expected: ${expected} to not equal actual: ${actual}`);
  }
}

let depth = 0;
export function assertArrayEqual(actual, expected, msg = '') {
  depth++;
  if (depth > 10) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
  assertTruthy(typeof actual.length === 'number');
  if (actual.length !== expected.length) {
    throw new Error(`${formatMsg(msg)}expected: array.length ${expected.length} to equal actual.length: ${actual.length}`);
  }
  const errors = [];
  for (let i = 0; i < actual.length; ++i) {
    try {
      assertDeepEqual(actual[i], expected[i]);
    } catch (err) {
      errors.push(`${formatMsg(msg)}expected: expected[${i}] ${expected[i]} to equal actual[${i}]: ${actual[i]}, ${err}`);
      if (errors.length === 10) {
        break;
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  --depth;
}

export function assertArrayEqualApproximately(actual, expected, range = 0.0000001, msg = '') {
  if (actual.length !== expected.length) {
    throw new Error(`${formatMsg(msg)}expected: array.length ${expected.length} to equal actual.length: ${actual.length}`);
  }
  const errors = [];
  for (let i = 0; i < actual.length; ++i) {
    if (Math.abs(actual[i] - expected[i]) > range) {
      errors.push(`${formatMsg(msg)}expected: expected[${i}] ${expected[i]} to equal actual[${i}]: ${actual[i]}`);
      if (errors.length === 10) {
        break;
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

export function assertThrowsWith(func, expectations, msg = '') {
  let error = '';
  if (config.throwOnError === false) {
    const origFn = console.error;
    const errors = [];
    console.error = function (...args) {
      errors.push(args.join(' '));
    };
    func();
    console.error = origFn;
    if (errors.length) {
      error = errors.join('\n');
      console.error(error);
    }
  } else {
    try {
      func();
    } catch (e) {
      console.error(e);  // eslint-disable-line
      error = e;
    }

  }

  if (config.noLint) {
    return;
  }

  assertStringMatchesREs(error.toString().replace(/\n/g, ' '), expectations, msg);
}

// check if it throws it throws with x
export function assertIfThrowsItThrowsWith(func, expectations, msg = '') {
  let error = '';
  let threw = false;
  if (config.throwOnError === false) {
    const origFn = console.error;
    const errors = [];
    console.error = function (...args) {
      errors.push(args.join(' '));
    };
    func();
    console.error = origFn;
    if (errors.length) {
      error = errors.join('\n');
      console.error(error);
    }
  } else {
    try {
      func();
    } catch (e) {
      console.error(e);  // eslint-disable-line
      error = e;
      threw = true;
    }

  }

  if (config.noLint) {
    return;
  }

  if (!threw) {
    return;
  }

  assertStringMatchesREs(error.toString().replace(/\n/g, ' '), expectations, msg);
}

function assertStringMatchesREs(actual, expectations, msg) {
  for (const expectation of expectations) {
    if (expectation instanceof RegExp) {
      if (!expectation.test(actual)) {
        throw new Error(`${formatMsg(msg)}expected: ${expectation}, actual: ${actual}`);
      }
    }
  }

}
export function assertWarnsWith(func, expectations, msg = '') {
  const warnings = [];
  const origWarnFn = console.warn;
  console.warn = function (...args) {
    origWarnFn.call(this, ...args);
    warnings.push(args.join(' '));
  };

  let error;
  try {
    func();
  } catch (e) {
    error = e;
  }

  console.warn = origWarnFn;

  if (error) {
    throw error;
  }

  if (config.noLint) {
    return;
  }

  assertStringMatchesREs(warnings.join(' '), expectations, msg);
}

export default {
  false: assertFalsy,
  equal: assertEqual,
  matchesRegEx: assertStringMatchesRegEx,
  notEqual: assertNotEqual,
  throwsWith: assertThrowsWith,
  true: assertTruthy,
};