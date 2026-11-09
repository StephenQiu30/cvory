import sharp from 'sharp';
process.once('message', (value: unknown) => {
  void (async () => {
    if (typeof value !== 'string') throw new Error('Invalid image.');
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || value.length > 2800000) throw new Error('Invalid image.');
    const raw = Buffer.from(match[2], 'base64');
    if (!raw.length || raw.length > 2097152 || raw.toString('base64') !== match[2])
      throw new Error('Invalid image.');
    const options = {limitInputPixels: 20000000, animated: false, failOn: 'warning' as const};
    const metadata = await sharp(raw, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1)
      throw new Error('Unsupported image.');
    await sharp(raw, options).stats();
    if (
      metadata.format === 'jpeg' &&
      (metadata.width || 0) <= 1200 &&
      (metadata.height || 0) <= 1600 &&
      !metadata.exif &&
      !metadata.icc
    )
      return `data:image/jpeg;base64,${raw.toString('base64')}`;
    const output = await sharp(raw, options)
      .rotate()
      .resize({width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true})
      .flatten({background: '#fff'})
      .jpeg({quality: 90})
      .toBuffer();
    if (output.length > 2097152) throw new Error('Image too large.');
    return `data:image/jpeg;base64,${output.toString('base64')}`;
  })()
    .then((result) => {
      process.send?.({result}, () => process.exit(0));
    })
    .catch(() => {
      process.send?.({error: true}, () => process.exit(0));
    });
});
