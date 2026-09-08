const test = require('tap').test;
global.window = {};
global.document = {createElement: () => ({getContext: () => ({})})};
global.ImageData = class { constructor (width, height) { this.data = new Uint8ClampedArray(width * height * 4); } };
const twgl = require('twgl.js');
const PenSkin = require('../../src/PenSkin');
const SVGSkin = require('../../src/SVGSkin');

test('pen resize preserves pixels before releasing old GPU resources', t => {
    const calls = [];
    const oldTexture = {};
    const oldFramebuffer = {};
    const nextTexture = {};
    const originalTexture = twgl.createTexture;
    const originalFramebuffer = twgl.createFramebufferInfo;
    twgl.createTexture = () => nextTexture;
    twgl.createFramebufferInfo = () => ({framebuffer: {}, attachments: [nextTexture]});
    const skin = Object.create(PenSkin.prototype);
    Object.assign(skin, {_texture: oldTexture, _framebuffer: {framebuffer: oldFramebuffer},
        _nativeSize: [2, 2], _rotationCenter: [0, 0], _markSilhouetteDirty () {},
        _drawPenTexture: texture => calls.push(['copy', texture]),
        _renderer: {gl: {deleteTexture: texture => calls.push(['texture', texture]),
            deleteFramebuffer: framebuffer => calls.push(['framebuffer', framebuffer]),
            clearColor () {}, clear () {}}}});
    try {
        skin._setCanvasSize([4, 4]);
        t.same(calls, [['framebuffer', oldFramebuffer], ['copy', oldTexture], ['texture', oldTexture]]);
        t.equal(skin._texture, nextTexture);
    } finally {
        twgl.createTexture = originalTexture;
        twgl.createFramebufferInfo = originalFramebuffer;
    }
    t.end();
});

test('SVG disposal disconnects pending image callbacks and frees MIPs', t => {
    const freed = [];
    const skin = new SVGSkin(1, {gl: {deleteTexture: texture => freed.push(texture)}});
    const texture = {};
    skin._scaledMIPs.push(texture);
    skin._svgImage.onload = () => t.fail('disposed image callback');
    skin.dispose();
    t.equal(skin._svgImage.onload, null);
    t.equal(skin._disposed, true);
    t.same(freed, [texture]);
    t.end();
});
