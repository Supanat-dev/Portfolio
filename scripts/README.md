# Website images

`optimize-images.cjs` creates WebP copies in `assets/optimized/`. It never edits or removes the original images.

After adding images to `data-gallery-srcs` or to an `<img>` tag in `index.html`, run:

```sh
npm install --no-save --package-lock=false sharp@0.35.5
node scripts/optimize-images.cjs --update-html
```

The generated images and manifests should be committed together with the HTML. The deployed static website does not need Node.js or Sharp.

Each image gets a 320px and 640px preview and a larger detail version (2400px for certificates/posters, 1600px for photos). Dimensions refer to the longest edge; portrait images keep their original proportions. Content hashes in filenames let browsers reuse unchanged images while fetching new files when a source changes.

The gallery loads small previews for its visible fan, and detail images for the selected image and its immediate neighbors. An original-image link remains available for reading fine print. Avoid preloading an entire album.
