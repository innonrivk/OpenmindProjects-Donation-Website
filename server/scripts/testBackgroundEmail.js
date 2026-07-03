import fs from 'fs';
import '../src/lib/env.js';
import prisma from '../src/lib/prisma.js';
import { sendTemplatedEmail } from '../src/services/email.js';

async function updateAndDispatch() {
  const imagePath = 'C:\\Users\\Lenovo\\.gemini\\antigravity-ide\\brain\\7ce5be97-58bc-4cf8-ad11-c3631543c127\\media__1783071078827.png';
  console.log(`Reading image from ${imagePath}...`);

  const fileData = fs.readFileSync(imagePath);
  const base64Image = `data:image/png;base64,${fileData.toString('base64')}`;

  console.log('Finding Honorary Certificate Template...');
  const template = await prisma.emailTemplate.findFirst({
    where: { name: 'Honorary Certificate Template' },
  });

  if (!template) {
    throw new Error('Honorary Certificate Template not found in DB!');
  }

  // Update template pdfConfig
  const updatedPdfConfig = {
    ...(template.pdfConfig || {}),
    backgroundImage: base64Image,
  };

  console.log('Updating template in database...');
  const updatedTemplate = await prisma.emailTemplate.update({
    where: { id: template.id },
    data: { pdfConfig: updatedPdfConfig },
  });

  console.log('🎉 Template updated successfully with the background image!');

  // Trigger test dispatch
  console.log('Sending test email to innon.programming@gmail.com...');
  const context = {
    donorName: 'Innon Programming Test',
    milestoneLabel: 'Silver "OMP Friend"',
    date: new Date().toLocaleDateString(),
  };

  const success = await sendTemplatedEmail('innon.programming@gmail.com', updatedTemplate, context);
  if (success) {
    console.log('🎉 Email sent successfully to innon.programming@gmail.com!');
  } else {
    console.error('❌ Email dispatch failed.');
  }

  await prisma.$disconnect();
}

updateAndDispatch().catch((err) => {
  console.error(err);
  process.exit(1);
});
