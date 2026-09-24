const test = require('tap').test;
global.window = {};
global.document = {createElement: () => ({getContext: () => ({})})};
const RenderWebGL = require('../../src/RenderWebGL');
const Skin = require('../../src/Skin');

const fakeRenderer = () => {
    const renderer = Object.create(RenderWebGL.prototype);
    renderer._allSkins = [];
    renderer._allDrawables = [];
    renderer._drawList = [];
    renderer._contextLost = false;
    renderer._gl = {};
    renderer.dirty = true;
    renderer._listeners = {};
    renderer.emit = name => {
        renderer._listeners[name] = (renderer._listeners[name] || 0) + 1;
    };
    return renderer;
};

test('losing the context stops drawing and asks the browser to restore it', t => {
    const renderer = fakeRenderer();
    let prevented = 0;
    renderer._onContextLost({
        preventDefault: () => {
            prevented++;
        }
    });
    t.equal(prevented, 1);
    t.equal(renderer.isContextLost, true);
    t.equal(renderer._listeners.ContextLost, 1);

    renderer._doExitDrawRegion = () => {
        throw new Error('draw must not touch GL while the context is lost');
    };
    t.doesNotThrow(() => renderer.draw());
    t.equal(renderer.dirty, true, 'the frame is still pending');
    t.end();
});

test('restoring the context rebuilds renderer resources and tells every skin', t => {
    const renderer = fakeRenderer();
    renderer._contextLost = true;
    let geometry = 0;
    renderer._createGeometry = () => {
        geometry++;
    };
    const skin = Object.create(Skin.prototype);
    skin._texture = {};
    skin._emptyImageTexture = {};
    skin._emptyImageData = {};
    let restored = 0;
    const custom = {
        onContextRestored: () => {
            restored++;
        }
    };
    renderer._allSkins = [skin, null, custom];
    renderer._regionId = {};
    renderer._exitRegion = () => {};

    renderer._onContextRestored();

    t.equal(renderer.isContextLost, false);
    t.equal(geometry, 1);
    t.equal(restored, 1);
    t.equal(skin._texture, null);
    t.equal(skin._emptyImageTexture, null);
    t.equal(renderer._regionId, null);
    t.equal(renderer._exitRegion, null);
    t.ok(renderer._shaderManager, 'a fresh shader cache exists');
    t.equal(renderer.dirty, true);
    t.equal(renderer._listeners.ContextRestored, 1);
    t.end();
});

test('pick skips holes and destroyed ids in a sparse draw list', t => {
    const renderer = fakeRenderer();
    renderer.clientSpaceToScratchBounds = () => ({
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        intersects: () => false
    });
    renderer._drawList = [3, 5, 7];
    delete renderer._drawList[1];
    renderer._allDrawables[3] = {
        interactive: true,
        getVisible: () => false
    };
    t.doesNotThrow(() => renderer.pick(0, 0));
    t.end();
});
