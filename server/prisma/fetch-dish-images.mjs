// Resolves a real photo for every seeded dish from Wikipedia/Wikimedia Commons
// and uploads it to the project's Cloudinary account.
//
// Usage: node --env-file=.env prisma/fetch-dish-images.mjs [--refresh] [--only slug-a,slug-b]
//
// The result (public URL + author/licence) is written to data/dish-images.json,
// which seed.js reads to attach cover images without doing any network calls.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';
import { dishes } from './data/dishes/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(here, 'data', 'dish-images.json');
// Seed photos live in their own Cloudinary folder so they never mix with user uploads
// (which are stored per purpose under recipe-community/<purpose>/<userId>).
const UPLOAD_FOLDER = 'recipe-community/seed/dishes';
const USER_AGENT = 'BepNhaSeed/1.0 (local recipe community seed; contact: seed@bepnha.local)';
const LANGS = ['vi', 'en'];

// Photos picked by hand from Wikimedia Commons when the automatic lookup found
// a generic or unrelated picture (e.g. "Cơm gà Hội An" -> Hội An old town).
const MANUAL_FILES = {
  'bun-oc': 'Bún ốc 2.jpg',
  'cao-lau': 'Cao lầu Hội An (2024).jpg',
  'banh-canh-cua': 'Tô bánh canh cua ở Q1 ng6th1n2022 (bánh canh bột gạo năng) (1).jpg',
  'banh-da-cua': 'BANH DA CUA 1.jpg',
  'chao-long': 'Cháo lòng.jpg',
  'chao-ga': 'Món ăn Tết 2023 (cháo gà) (2).jpg',
  'bun-ca': 'Bún cá rô, ng14th8n2022 (3).jpg',
  'bun-nuoc-leo': 'Bún nước lèo.jpg',
  'sup-mang-cua': 'Súp cua Việt Nam.jpg',
  'mien-ga': 'Vùng Cùa ở Cam Lộ th5n2023-Phương Gia Trang (tô miến gà) (2).jpg',
  'com-ga-hoi-an': 'Cơm gà sườn nướng, ng23th8n2022 (Đùi gà nướng) (3).jpg',
  'ca-kho-to': 'Cá kho tộ.JPG',
  'ga-kho-gung': 'Nồi gà ta kho vàng ươm, ng6th7n2022 (2).jpg',
  'vit-quay': 'Vịt quay thất khê.jpg',
  'nem-ran': 'Cha_gio.jpg',
  'thit-rang-chay-canh': 'Thit rang chay canh.jpg',
  'trau-gac-bep': 'Thịt trâu gác bếp Lam Sơn Food.jpg',
  'luon-om-chuoi-dau': 'Vinh - dish of eel and green banana Mar 2024.jpg',
  'tom-rim': 'Tết 2024 nhà mình (rim tôm thịt) (1).jpg',
  'ca-hap-xi-dau': 'Nhà mình Lễ 30th4n2023 (món cá hấp hành tây) (1).jpg',
  'banh-xeo': 'Bánh xèo with nước mắm.jpg',
  'banh-khot': 'Bánh khọt by Nguyenhai314.jpg',
  'banh-can': 'Bánh căn 1.jpg',
  'banh-beo': 'Bánh bèo chén.jpg',
  'banh-tet': 'Bánh tét sính lễ.JPG',
  'goi-cuon': 'Gỏi cuốn.jpg',
  'banh-duc': 'Bánh đúc lạc.jpg',
  'nem-chua-ran': 'Nem-chua-ran2.jpg',
  'banh-bo': 'Banh_bo_hap.jpg',
  'banh-chuoi-nuong': 'Banana cake.jpg',
  'rau-cau-dua': 'Rau câu dừa tươi ở BiC Phú Thạnh tháng 10 năm 2018 (1).jpg',
  'tra-dao-cam-sa': 'Trà hồng đào trong ly cao, ng19th7n2019.jpg',
  'sinh-to-bo': 'Sinh tố bơ.jpg',
  'sua-chua-nep-cam': 'Sữa chua nếp cẩm.jpg',
  'xoi-xeo': 'Xôi xéo.jpg',
  'xoi-dau-xanh': 'Xôi đỗ xanh.jpg',
  'che-dau-den': 'Chè đậu đen nhà làm (tháng 1 năm 2018) (2).jpg',
  'che-ba-mau': 'Chè bà ba.jpg',
  'pho-chay': 'Tofu noodle soup (Phở chay) - Pho Hanoi Authentic 2024-12-01.jpg',
  'bun-rieu-chay': 'Bun rieu with herbs.jpg',
  'banh-xeo-chay': 'Bánh xèo 2.jpg',
  'nom-du-du': 'Khmer-style green papaya salad.jpg',
  'gia-cay': 'Chân giò nấu giả cầy 2.JPG',
  'bo-sot-vang': 'Bò sốt vang ngày 21 tháng 1 năm 2019 (2).jpg',
  'canh-bi-dao-nam': 'Bữa cơm nhà Mheo, ng19th1n2020 (nồi canh bí đao).jpg',
  'dau-hu-kho-nam': 'Trút đậu hũ kho từ chảo, ng16th7n2022.jpg',
  'banh-gio': 'Bánh giò.jpg',
  'banh-mi-thit': 'Bánh mì thịt nguội.jpg',
  'banh-trang-nuong': 'Pizzabanhtrangnuong1.jpg',
  'canh-bun': 'Tô bún riêu (canh bún) ng12th8n2022 (1).jpg',
  'dau-phu-sot-ca-chua': 'Dau sot ca, tofu stuffed with pork, in tomato sauce.jpg',
};

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((slug) => slug.trim())) : null;

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

function saveManifest() {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function stripHtml(value) {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function wiki(lang, params) {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Wikipedia ${lang} returned ${response.status}`);
  return response.json();
}

async function pageImage(lang, title) {
  const data = await wiki(lang, {
    action: 'query',
    prop: 'pageimages',
    piprop: 'name|thumbnail',
    pithumbsize: '1400',
    redirects: '1',
    titles: title,
  });
  const page = data.query?.pages?.[0];
  if (!page || page.missing || !page.pageimage || !page.thumbnail?.source) return null;
  return { lang, pageTitle: page.title, file: page.pageimage };
}

async function searchImage(lang, term) {
  const search = await wiki(lang, { action: 'query', list: 'search', srsearch: term, srlimit: '6' });
  const titles = (search.query?.search ?? []).map((item) => item.title).filter(Boolean);
  if (!titles.length) return null;
  const data = await wiki(lang, {
    action: 'query',
    prop: 'pageimages',
    piprop: 'name|thumbnail',
    pithumbsize: '1400',
    redirects: '1',
    titles: titles.join('|'),
  });
  for (const page of data.query?.pages ?? []) {
    if (page.pageimage && page.thumbnail?.source) {
      return { lang, pageTitle: page.title, file: page.pageimage };
    }
  }
  return null;
}

async function resolveImage(dish) {
  if (MANUAL_FILES[dish.slug]) {
    return { lang: 'commons', pageTitle: dish.title, file: MANUAL_FILES[dish.slug] };
  }
  const titles = [dish.wiki, dish.title].filter(Boolean);
  for (const lang of LANGS) {
    for (const title of titles) {
      const found = await pageImage(lang, title);
      if (found) return found;
    }
  }
  for (const lang of LANGS) {
    for (const title of titles) {
      const found = await searchImage(lang, `${title} món ăn`);
      if (found) return found;
    }
  }
  return null;
}

async function imageInfo(lang, file) {
  const data = await wiki('commons', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1400',
    titles: `File:${file}`,
  });
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl || info.url,
    sourcePage: info.descriptionurl,
    credit: stripHtml(meta.Artist?.value) || 'Wikimedia Commons contributors',
    license: stripHtml(meta.LicenseShortName?.value) || 'Free licence on Wikimedia Commons',
    licenseUrl: meta.LicenseUrl?.value || '',
  };
}

async function downloadImage(imageUrl, attempt = 1) {
  const url = new URL(imageUrl);
  url.search = '';
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (response.status === 429 && attempt <= 4) {
    await delay(1500 * attempt);
    return downloadImage(imageUrl, attempt + 1);
  }
  if (!response.ok) throw new Error(`Image download failed (${response.status})`);
  const type = response.headers.get('content-type') || 'image/jpeg';
  return { bytes: Buffer.from(await response.arrayBuffer()), type };
}

async function uploadToCloudinary({ bytes, type }, publicId) {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error('Cloudinary credentials are missing from server/.env');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${UPLOAD_FOLDER}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${env.cloudinaryApiSecret}`)
    .digest('hex');
  const form = new FormData();
  form.set('file', new Blob([bytes], { type }), 'dish.jpg');
  form.set('folder', UPLOAD_FOLDER);
  form.set('overwrite', 'true');
  form.set('public_id', publicId);
  form.set('timestamp', String(timestamp));
  form.set('api_key', env.cloudinaryApiKey);
  form.set('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.secure_url) {
    throw new Error(`Cloudinary upload failed (${response.status}): ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
  }
  return {
    secureUrl: body.secure_url,
    format: body.format,
    bytes: body.bytes,
    width: body.width,
    height: body.height,
  };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const targets = dishes.filter((dish) => !only || only.has(dish.slug));
  let ok = 0;
  let skipped = 0;
  const failed = [];

  for (const [index, dish] of targets.entries()) {
    const label = `[${index + 1}/${targets.length}] ${dish.title} (${dish.slug})`;
    if (!refresh && manifest[dish.slug]?.secureUrl) {
      skipped += 1;
      console.log(`${label}: cached`);
      continue;
    }
    try {
      const resolved = await resolveImage(dish);
      if (!resolved) {
        failed.push(dish.slug);
        console.log(`${label}: no image found`);
        continue;
      }
      const info = await imageInfo(resolved.lang, resolved.file);
      if (!info?.url) {
        failed.push(dish.slug);
        console.log(`${label}: no image metadata`);
        continue;
      }
      const publicId = dish.slug;
      const downloaded = await downloadImage(info.url);
      const uploaded = await uploadToCloudinary(downloaded, publicId);
      manifest[dish.slug] = {
        publicId: `${UPLOAD_FOLDER}/${publicId}`,
        secureUrl: uploaded.secureUrl,
        format: uploaded.format,
        bytes: uploaded.bytes,
        width: uploaded.width,
        height: uploaded.height,
        wikiLang: resolved.lang,
        wikiTitle: resolved.pageTitle,
        sourceFile: resolved.file,
        sourcePage: info.sourcePage,
        credit: info.credit,
        license: info.license,
        licenseUrl: info.licenseUrl,
      };
      saveManifest();
      ok += 1;
      console.log(`${label}: ${resolved.pageTitle} — ${info.credit} (${info.license})`);
    } catch (error) {
      failed.push(dish.slug);
      console.log(`${label}: ERROR ${error.message}`);
    }
    await delay(250);
  }

  console.log(`\nDone. uploaded=${ok} cached=${skipped} failed=${failed.length}`);
  if (failed.length) console.log(`Failed slugs: ${failed.join(', ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
