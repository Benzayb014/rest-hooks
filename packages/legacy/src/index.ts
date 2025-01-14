Object.hasOwn =
  Object.hasOwn ||
  /* istanbul ignore next */ function hasOwn(it, key) {
    return Object.prototype.hasOwnProperty.call(it, key);
  };
export * from './resource/index.js';
export { default as useStatefulResource } from './useStatefulResource.js';
export * from './endpoint/index.js';
export * as rest3 from './rest-3/index.js';
