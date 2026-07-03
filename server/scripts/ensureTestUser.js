import '../src/lib/env.js';
import prisma from '../src/lib/prisma.js';

async function ensureUser() {
  const email = 'innon.programming@gmail.com';
  console.log(`Checking if user ${email} exists...`);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        email,
        firstName: 'Innon',
        lastName: 'Programming',
        role: 'DONOR',
        country: 'Israel',
      },
    });
    console.log(`🎉 User ${email} added successfully to the database!`);
  } else {
    console.log(`User ${email} already exists in the database.`);
  }

  await prisma.$disconnect();
}

ensureUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
