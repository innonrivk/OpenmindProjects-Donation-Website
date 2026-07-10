import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Starting standalone delete test in server root...');
  try {
    // 1. Create a template
    const tempTmpl = await prisma.emailTemplate.create({
      data: {
        name: `Stand-alone Delete Test ${Date.now()}`,
        subject: 'Delete Sub',
        bodyHtml: '<p>Delete body</p>',
      },
    });
    console.log('Created template:', tempTmpl.id);

    // 2. Create a dispatch log
    const log = await prisma.dispatchLog.create({
      data: {
        emailTemplateId: tempTmpl.id,
        triggeredBy: 'some-admin-id-placeholder',
        recipientCount: 1,
        status: 'QUEUED',
      },
    });
    console.log('Created dispatch log:', log.id);

    // 3. Create a recipient
    const recipient = await prisma.dispatchRecipient.create({
      data: {
        dispatchId: log.id,
        email: 'test@example.com',
        status: 'QUEUED',
      },
    });
    console.log('Created recipient:', recipient.id);

    // 4. Try transaction delete
    console.log('Executing delete transaction...');
    await prisma.$transaction([
      prisma.automationTrigger.deleteMany({
        where: { emailTemplateId: tempTmpl.id },
      }),
      prisma.dispatchLog.deleteMany({
        where: { emailTemplateId: tempTmpl.id },
      }),
      prisma.emailTemplate.delete({
        where: { id: tempTmpl.id },
      }),
    ]);
    console.log('Delete transaction succeeded!');
  } catch (err) {
    console.error('Delete transaction failed:', err);
  } finally {
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
  }
}

run();
