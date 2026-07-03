import '../src/lib/env.js';
import prisma from '../src/lib/prisma.js';
import { sendTemplatedEmail } from '../src/services/email.js';

async function testDispatch() {
  console.log('Sending test templated email to innon.programming@gmail.com...');

  // 1. Find the newly seeded default honorary certificate template
  const template = await prisma.emailTemplate.findFirst({
    where: { name: 'Honorary Certificate Template' },
  });

  if (!template) {
    throw new Error('Default template not found. Please run the seed/seeding script first.');
  }

  // 2. Set context variables matching the new template coordinates
  const context = {
    donorName: 'Innon Programming Test',
    milestoneLabel: 'Silver "OMP Friend"',
    date: new Date().toLocaleDateString(),
  };

  // 3. Trigger email send
  const success = await sendTemplatedEmail('innon.programming@gmail.com', template, context);
  if (success) {
    console.log('🎉 Email sent successfully to innon.programming@gmail.com!');
  } else {
    console.error('❌ Email dispatch failed.');
  }

  await prisma.$disconnect();
}

testDispatch().catch((err) => {
  console.error(err);
  process.exit(1);
});
