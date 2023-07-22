const deviceToResources = new Map();

function addDeviceResource(device, resource) {
  const resources = deviceToResources.get(device) || [];
  deviceToResources.set(device, resources);
  resources.push(resource);
  return resource;
}

function freeDeviceResources(device) {
  const resources = deviceToResources.get(device) || [];
  resources.forEach(r => r.destroy());
}

GPUDevice.prototype.createTexture = (function(origFn) {
  return function(...args) {
    return addDeviceResource(this, origFn.call(this, ...args));
  }
})(GPUDevice.prototype.createTexture);

GPUDevice.prototype.createBuffer = (function(origFn) {
  return function(...args) {
    return addDeviceResource(this, origFn.call(this, ...args));
  }
})(GPUDevice.prototype.createBuffer);

export async function testWithDevice(fn) {
  const adapter = await globalThis?.navigator?.gpu?.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    this.skip();
    return;
  }
  try {
    await fn(device);
  } finally {
    freeDeviceResources(device);
    device.destroy();
  }
}

export async function testWithDeviceAndDocument(fn) {
  if (typeof document === undefined) {
    this.skip();
    return;
  }
  return testWithDevice(fn);
}
