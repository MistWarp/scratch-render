const test = require('tap').test;
global.window = {};
global.document = {createElement: () => ({getContext: () => ({})})};
const RenderWebGL = require('../../src/RenderWebGL');
const Drawable = require('../../src/Drawable');
const Skin = require('../../src/Skin');

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

test('a skin tracks exactly the drawables that use it', t => {
    const renderer = fakeRenderer();
    const first = new Skin(1, renderer);
    const second = new Skin(2, renderer);
    const drawables = [0, 1, 2, 3, 4].map(id => new Drawable(id, renderer));
    const attachedTo = skin => skin.attachedDrawables.map(drawable => drawable.id).sort();

    for (const drawable of drawables) drawable.skin = first;
    t.same(attachedTo(first), [0, 1, 2, 3, 4]);

    drawables[1].skin = second;
    drawables[4].skin = second;
    drawables[0].skin = null;
    t.same(attachedTo(first), [2, 3]);
    t.same(attachedTo(second), [1, 4]);

    drawables[1].skin = second;
    t.same(attachedTo(second), [1, 4], 'setting the same skin again changes nothing');

    for (let round = 0; round < 50; round++) {
        for (const drawable of drawables) {
            drawable.skin = (drawable.id + round) % 3 === 0 ? first : second;
        }
    }
    const expectedFirst = drawables.filter(drawable => drawable.skin === first).map(drawable => drawable.id);
    const expectedSecond = drawables.filter(drawable => drawable.skin === second).map(drawable => drawable.id);
    t.same(attachedTo(first), expectedFirst);
    t.same(attachedTo(second), expectedSecond);

    for (const drawable of drawables) drawable.dispose();
    t.same(first.attachedDrawables, []);
    t.same(second.attachedDrawables, []);
    t.end();
});

test('altering a skin only reaches the drawables that use it', t => {
    const renderer = fakeRenderer();
    const first = new Skin(1, renderer);
    const second = new Skin(2, renderer);
    const drawables = [0, 1, 2, 3].map(id => new Drawable(id, renderer));
    drawables[0].skin = first;
    drawables[1].skin = second;
    drawables[2].skin = first;
    drawables[3].skin = first;
    drawables[2].skin = second;

    const reached = [];
    for (const drawable of drawables) {
        drawable._skinWasAltered = () => reached.push(drawable.id);
    }
    renderer.skinWasAltered(first);
    t.same(reached.sort(), [0, 3]);
    reached.length = 0;
    renderer.skinWasAltered(second);
    t.same(reached.sort(), [1, 2]);
    t.end();
});
