const test = require('tap').test;

global.window = {};
global.document = {
    createElement: () => ({getContext: () => {}})
};

const RenderWebGL = require('../../src/RenderWebGL');

test('texture filtering only updates when it changes', t => {
    const calls = [];
    const renderer = Object.create(RenderWebGL.prototype);
    renderer._gl = {
        TEXTURE_2D: 1,
        TEXTURE_MIN_FILTER: 2,
        TEXTURE_MAG_FILTER: 3,
        texParameteri: (...args) => calls.push(args)
    };
    renderer._textureFilterModes = new WeakMap();
    const texture = {};

    renderer._setTextureFilter(texture, 4);
    renderer._setTextureFilter(texture, 4);
    renderer._setTextureFilter(texture, 5);

    t.equal(calls.length, 4);
    t.same(calls.map(call => call[2]), [4, 4, 5, 5]);
    t.end();
});
