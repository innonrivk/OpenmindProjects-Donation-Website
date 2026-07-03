import '../src/lib/env.js';
import prisma from '../src/lib/prisma.js';

async function seedDefaultTemplate() {
  console.log('Checking for default honorary certificate template...');

  let template = await prisma.emailTemplate.findFirst({
    where: { name: 'Honorary Certificate Template' },
  });

  if (!template) {
    template = await prisma.emailTemplate.create({
      data: {
        name: 'Honorary Certificate Template',
        subject: 'Congratulations {donorName}! Your Honorary Certificate from OpenmindProjects',
        bodyHtml: `
          <h3>Dear {donorName},</h3>
          <p>Congratulations on unlocking and claiming your milestone reward: <strong>{milestoneLabel}</strong>!</p>
          <p>Your ongoing support enables us to build sustainable community programs and training camps. We are honored to have you as part of our journey.</p>
          <p>Please find your official honorary certificate attached to this email.</p>
          <p>Best regards,<br/>The OpenmindProjects Team</p>
        `.trim(),
        pdfConfig: {
          fields: [
            { type: 'text', x: 200, y: 120, value: 'Honorary Certificate', fontSize: 32, color: '#4285f4' },
            { type: 'text', x: 260, y: 170, value: 'of Appreciation', fontSize: 20, color: '#6b7280' },
            { type: 'text', x: 100, y: 260, value: 'This certificate is proudly presented to:', fontSize: 14, color: '#202124', align: 'center', width: 641 },
            { type: 'text', x: 100, y: 310, value: '{donorName}', fontSize: 28, color: '#202124', align: 'center', width: 641 },
            { type: 'text', x: 100, y: 390, value: 'In recognition of unlocking the OMP milestone objective:', fontSize: 12, color: '#6b7280', align: 'center', width: 641 },
            { type: 'text', x: 100, y: 420, value: '{milestoneLabel}', fontSize: 18, color: '#4285f4', align: 'center', width: 641 },
            { type: 'text', x: 100, y: 490, value: 'Awarded on: {date}', fontSize: 11, color: '#9ca3af', align: 'center', width: 641 },
          ],
        },
      },
    });
    console.log('🎉 Default honorary certificate template created successfully!');
  } else {
    console.log('Template "Honorary Certificate Template" already exists.');
  }

  // Bind the MILESTONE_CLAIMED trigger rule if it does not exist
  const trigger = await prisma.automationTrigger.findFirst({
    where: { eventName: 'MILESTONE_CLAIMED', emailTemplateId: template.id },
  });

  if (!trigger) {
    await prisma.automationTrigger.create({
      data: {
        eventName: 'MILESTONE_CLAIMED',
        emailTemplateId: template.id,
        adminAssignments: {
          create: [
            { role: 'SYSADMIN' },
            { role: 'SUPER_ADMIN' },
          ],
        },
      },
    });
    console.log('🎉 Binded default MILESTONE_CLAIMED automation trigger!');
  } else {
    console.log('Default trigger rule already exists.');
  }

  await prisma.$disconnect();
}

seedDefaultTemplate().catch((err) => {
  console.error(err);
  process.exit(1);
});
