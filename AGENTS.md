# AGENTS.md

scratch-render draws the MistWarp stage with WebGL: sprites, pen, text bubbles, collision and touching queries. It is a fork of TurboWarp's renderer, written in CommonJS JavaScript, and scratch-gui pins it to a commit.

## Where code goes

- `src/RenderWebGL.js` is the public renderer the VM and GUI call. `Drawable.js` is one drawn item, the `*Skin.js` files are its pixels (bitmap, SVG, pen, text bubble), and `Silhouette.js` is the CPU copy used for collision.
- `src/shaders/` holds the GLSL, and `ShaderManager.js` builds it.

## Things that look safe to change but are not

- **Shader source text is public API.** Unsandboxed extensions patch `sprite.vert` and `sprite.frag` by exact string replacement inside `ShaderManager._buildShader`. Never edit those two files for a MistWarp feature. Add a separate shader built outside `_buildShader` and `_shaderCache`, as `triangle.vert` and `triangle.frag` do. `test/unit/ShaderSourceTests.js` guards this.
- **Collision and color sensing must match Scratch.** Changes to `Silhouette`, `Drawable` bounds or pen are measured with the scratch-parity project (git.rotur.dev/Mist/scratch-parity), and its results must not change.
- Keep `RenderWebGL` method names and signatures stable. scratch-vm, scratch-gui and extensions call them directly.

## Checks

`npm run lint`, `npm run tap`, `npm run build`, and `npm run check:conventions`, which rejects code comments and em dashes in the lines you add.

## Working here

- The default branch is `develop`. This repo is a fork, so open PRs with `gh pr create -R MistWarp/scratch-render --base develop`.
- To try a change in the editor, check this repo out next to scratch-gui and run `pnpm run link` there.
- No code comments: name things so the code explains itself. No em dashes anywhere.
- Never add `Co-Authored-By` or any AI or tool attribution to commits or PRs.
- READMEs are overviews. Documentation goes in MistWarp/docs (https://mistwarp.org/docs/).
