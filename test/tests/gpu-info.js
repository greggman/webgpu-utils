import { describe, it } from '../mocha-support.js';

function objLikeToObj(objLike) {
  const obj = {};
  for (const k in objLike) {
    obj[k] = objLike[k];
  }
  return obj;
}

export async function getInfo() {
  const adapter = await navigator.gpu.requestAdapter();
  const info = adapter?.info ?? await adapter?.requestAdapterInfo() ?? {};
  const title = JSON.stringify(objLikeToObj(info), null, 2);

  describe('gpu info', () => {
    it(title, () => {});
  });
}

