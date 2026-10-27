import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const categories = [
  { name: 'Món Việt', slug: 'mon-viet', description: 'Món ăn quen thuộc trong gia đình Việt.' },
  { name: 'Món chay', slug: 'mon-chay', description: 'Công thức không sử dụng thịt cá.' },
  { name: 'Bữa sáng', slug: 'bua-sang', description: 'Món ăn bắt đầu ngày mới.' },
];

const tags = [
  { name: 'Món chay', slug: 'mon-chay' },
  { name: 'Thuần chay', slug: 'thuan-chay' },
  { name: 'Eat clean', slug: 'eat-clean' },
  { name: 'Dưới 30 phút', slug: 'duoi-30-phut' },
  { name: 'Không sữa', slug: 'khong-sua' },
  { name: 'Không gluten', slug: 'khong-gluten' },
];

const recipes = [
  {
    title: 'Canh rau củ thanh mát',
    slug: 'canh-rau-cu-thanh-mat',
    description: 'Bát canh nhẹ bụng cho bữa cơm hằng ngày.',
    categorySlug: 'mon-viet',
    cookTimeMinutes: 25,
    totalTimeMinutes: 35,
    servings: 3,
    tagSlugs: ['mon-chay', 'thuan-chay', 'eat-clean', 'duoi-30-phut'],
    ingredients: [
      { displayName: 'Cà rốt', quantity: '1', unit: 'củ' },
      { displayName: 'Bắp cải xanh', quantity: '300', unit: 'g' },
    ],
    steps: [
      { instruction: 'Sơ chế và cắt rau củ vừa ăn.' },
      { instruction: 'Nấu rau củ đến khi mềm, nêm vừa vị.' },
    ],
  },
  {
    title: 'Bún trộn rau xanh',
    slug: 'bun-tron-rau-xanh',
    description: 'Món trộn nhanh gọn với nhiều rau tươi.',
    categorySlug: 'mon-chay',
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    servings: 2,
    tagSlugs: ['mon-chay', 'thuan-chay', 'khong-sua', 'duoi-30-phut'],
    ingredients: [
      { displayName: 'Bún tươi', quantity: '400', unit: 'g' },
      { displayName: 'Rau xà lách', quantity: '200', unit: 'g' },
    ],
    steps: [
      { instruction: 'Rửa sạch rau và để ráo.' },
      { instruction: 'Trụng bún, trộn cùng rau và nước sốt.' },
    ],
  },
  {
    title: 'Yến mạch trái cây buổi sáng',
    slug: 'yen-mach-trai-cay-buoi-sang',
    description: 'Bữa sáng đơn giản, no lâu và dễ chuẩn bị.',
    categorySlug: 'bua-sang',
    cookTimeMinutes: 5,
    totalTimeMinutes: 10,
    servings: 1,
    tagSlugs: ['eat-clean', 'khong-sua', 'duoi-30-phut'],
    ingredients: [
      { displayName: 'Yến mạch', quantity: '50', unit: 'g' },
      { displayName: 'Chuối', quantity: '1', unit: 'quả' },
    ],
    steps: [
      { instruction: 'Ngâm yến mạch với sữa hạt.' },
      { instruction: 'Thêm trái cây và dùng ngay.' },
    ],
  },
];

async function main() {
  const categoryMap = Object.fromEntries(await Promise.all(categories.map(async (category) => [
    category.slug,
    await prisma.category.upsert({ where: { slug: category.slug }, update: category, create: category }),
  ])));

  const tagMap = Object.fromEntries(await Promise.all(tags.map(async (tag) => [
    tag.slug,
    await prisma.tag.upsert({ where: { slug: tag.slug }, update: tag, create: tag }),
  ])));

  const passwordHash = await bcrypt.hash('seed-password-change-me', 12);
  const existingUser = await prisma.user.findFirst({ where: { email: 'seed@bepnha.local' } });
  const user = existingUser
    ? await prisma.user.update({ where: { id: existingUser.id }, data: { status: 'ACTIVE', role: 'EDITOR' } })
    : await prisma.user.create({
      data: {
        email: 'seed@bepnha.local',
        username: 'bepnha_seed',
        passwordHash,
        status: 'ACTIVE',
        role: 'EDITOR',
        profile: { create: { displayName: 'Bếp Nhà' } },
      },
    });

  const seededRecipes = [];
  for (const recipe of recipes) {
    const { categorySlug, tagSlugs, ingredients, steps, ...data } = recipe;
    const recipeData = {
      ...data,
      categoryId: categoryMap[categorySlug].id,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: new Date(),
      authorId: user.id,
    };
    const seeded = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.recipe.upsert({
        where: { slug: recipe.slug },
        update: recipeData,
        create: recipeData,
      });
      await transaction.recipeIngredient.deleteMany({ where: { recipeId: saved.id } });
      await transaction.recipeStep.deleteMany({ where: { recipeId: saved.id } });
      await transaction.recipeTag.deleteMany({ where: { recipeId: saved.id } });
      await transaction.recipeIngredient.createMany({
        data: ingredients.map((item, index) => ({ ...item, recipeId: saved.id, sortOrder: index })),
      });
      await transaction.recipeStep.createMany({
        data: steps.map((item, index) => ({ ...item, recipeId: saved.id, stepNumber: index + 1 })),
      });
      await transaction.recipeTag.createMany({
        data: tagSlugs.map((slug) => ({ recipeId: saved.id, tagId: tagMap[slug].id })),
      });
      return saved;
    });
    seededRecipes.push(seeded);
  }

  const challengeTitle = 'Thử thách món chay 7 ngày';
  let challenge = await prisma.challenge.findFirst({ where: { title: challengeTitle } });
  if (!challenge) {
    challenge = await prisma.challenge.create({
      data: {
        createdById: user.id,
        title: challengeTitle,
        description: 'Chia sẻ một món chay bạn nấu trong tuần này.',
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });
  }

  for (const recipe of seededRecipes.slice(0, 2)) {
    await prisma.challengeEntry.upsert({
      where: { challengeId_recipeId: { challengeId: challenge.id, recipeId: recipe.id } },
      update: {},
      create: { challengeId: challenge.id, recipeId: recipe.id, submittedById: user.id },
    });
  }

  console.log(`Seeded ${categories.length} categories, ${tags.length} tags, ${recipes.length} recipes and 1 challenge.`);
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
