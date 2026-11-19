import {readFile, writeFile} from 'node:fs/promises';
import process from 'node:process';

const [source, target, variant] = process.argv.slice(2);
if (!source || !target || source === target || !['a', 'b'].includes(variant)) {
  throw new Error(
    'Pass an existing service file, a new output path, and a or b',
  );
}
const service = JSON.parse(await readFile(source, 'utf8'));
let pending;
const order = [];
for (const item of service.order) {
  if (
    item.sectionCard &&
    item.slides &&
    !Array.isArray(item.slides) &&
    item.slides.slides.length === 0
  ) {
    pending = item.sectionCard;
    continue;
  }
  if (
    pending &&
    !(
      variant === 'a' &&
      ('sermon' in item ||
        item.theme === '00000000-0000-4000-8000-000000000106')
    ) &&
    ['song', 'slides', 'bible', 'sermon', 'liturgy'].some(key => key in item)
  ) {
    item.sectionCard ??= pending;
    pending = undefined;
  }
  order.push(item);
}
service.order = order;
await writeFile(target, JSON.stringify(service, null, 2), {
  encoding: 'utf8',
  flag: 'wx',
});
