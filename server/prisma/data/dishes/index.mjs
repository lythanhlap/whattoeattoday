import { banhAnVat } from './banh-an-vat.mjs';
import { chayVaTrangMieng } from './chay-va-trang-mieng.mjs';
import { monMan } from './mon-man.mjs';
import { monNuoc } from './mon-nuoc.mjs';

export const dishes = [...monNuoc, ...monMan, ...banhAnVat, ...chayVaTrangMieng];

const slugs = new Set(dishes.map((dish) => dish.slug));
if (slugs.size !== dishes.length) {
  throw new Error('Duplicate dish slugs in seed data');
}
