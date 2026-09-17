const test = require('tap').test;
global.window = {};
global.document = {createElement: () => ({getContext: () => ({})})};
const RenderWebGL = require('../../src/RenderWebGL');
const Drawable = require('../../src/Drawable');

const fakeRenderer = () => {
    const renderer = Object.create(RenderWebGL.prototype);
    renderer._allSkins = {};
    renderer._allDrawables = [];
    return renderer;
};

test('_reskin survives a skin id that was already destroyed', t => {
    const renderer = fakeRenderer();
    const newSkin = {id: 7};
    t.doesNotThrow(() => renderer._reskin(7, newSkin));
    t.equal(renderer._allSkins[7], newSkin);
    t.end();
});

test('destroySkin survives an unknown skin id', t => {
    const renderer = fakeRenderer();
    t.doesNotThrow(() => renderer.destroySkin(99));
    t.end();
});

test('a drawable with no skin can still compute its transform', t => {
    const renderer = fakeRenderer();
    const fresh = new Drawable(1, renderer);
    t.doesNotThrow(() => fresh._calculateTransform(), 'never had a skin');

    const destroyed = new Drawable(2, renderer);
    renderer._allDrawables[2] = destroyed;
    renderer.updateDrawableSkinId(2, 1234);
    destroyed._rotationCenterDirty = true;
    destroyed._skinScaleDirty = true;
    t.doesNotThrow(() => destroyed._calculateTransform(), 'skin id no longer exists');
    t.end();
});

test('convex hull of a drawable with no skin is empty, not a crash', t => {
    const renderer = fakeRenderer();
    const drawable = new Drawable(2, renderer);
    renderer._allDrawables[2] = drawable;

    t.same(renderer._getConvexHullPointsForDrawable(2), []);
    t.same(renderer._getConvexHullPointsForDrawable(404), [], 'unknown drawable id too');

    drawable.setConvexHullPoints([]);
    t.equal(drawable.needsConvexHullPoints(), true, 'an empty hull keeps getFastBounds on the AABB path');
    t.doesNotThrow(() => drawable.getFastBounds());
    t.end();
});
