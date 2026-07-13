import '../src/lib/env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { seedHistoricalTransactions } from './seedTransactions.js';
import { recalculateUserTiers } from '../src/services/tierAssignmentService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── One-Time Migration Step ──
  try {
    console.log('🔄 Running one-time migration for existing donation boxes...');
    const existingBoxes = await prisma.donationBox.findMany();
    let migratedCount = 0;
    for (const box of existingBoxes) {
      if (!box.tierId && box.tierDetails && box.tierDetails.includes('|')) {
        const perksArray = box.tierDetails.split('|').map((p) => p.trim()).filter(Boolean);
        await prisma.donationBox.update({
          where: { id: box.id },
          data: {
            perks: perksArray,
            tierDetails: '',
          },
        });
        migratedCount++;
      }
    }
    console.log(`  📦 Migrated ${migratedCount} donation box(es) successfully.`);
  } catch (err) {
    console.log('  ⚠️ Migration step skipped/failed:', err.message);
  }

  // ── Cleanup existing data (order matters for FK constraints) ──
  await prisma.adminRoleAssignment.deleteMany();
  await prisma.automationTrigger.deleteMany();
  await prisma.dispatchLog.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.userTier.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.claimedMilestone.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.user.deleteMany();
  await prisma.piggyBank.deleteMany();
  await prisma.projectDetail.deleteMany();
  await prisma.donationMilestone.deleteMany();
  await prisma.donationBox.deleteMany();
  await prisma.tier.deleteMany();
  await prisma.websiteContent.deleteMany();
  await prisma.receiptSettings.deleteMany();
  console.log('  🧹 Cleaned existing data');

  // ── Seed Receipt Settings (GLOBAL Fallback) ──
  await prisma.receiptSettings.create({
    data: {
      donationType: 'GLOBAL',
      emailSubjectTemplate: 'Thank you for your donation — Official OMP Receipt 🎉',
      pdfThankYouMessage: 'We appreciate your generous support.',
      pdfFooterNote: 'This PDF is your official donation receipt. Please retain for your records.',
      pdfSignatureName: 'The OpenmindProjects Team',
    },
  });
  console.log('  ✅ Global receipt settings seeded');

  // ── Seed Admin User ──
  const adminEmail = 'admin@openmindprojects.org';
  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!rawAdminPassword && process.env.NODE_ENV === 'production') {
    throw new Error('SEED_ADMIN_PASSWORD environment variable is required in production to seed admin.');
  }
  const adminPassword = rawAdminPassword || '12345678';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SYSADMIN',
      isProtected: true,
      password: adminPasswordHash,
      country: 'Global',
    },
  });
  console.log('  ✅ Admin user seeded');

  // ── Seed Tiers ──
  const regularTier = await prisma.tier.create({
    data: {
      tierLevel: 1,
      name: 'Regular',
      minAmount: 1,
      maxAmount: 84,
      isAutoAppliedBySum: true,
      perks: [
        'Monthly updates from our newsletter',
        'Invitation to "OMP\'s yearly impact" yearly zoom event',
        'Monthly seed coupons for voting based on the donated amount (1 seed = $1)',
        'Access to OMP group tours at a discounted rate (the real price without the middlemen)',
      ],
    },
  });

  const shareholderTier = await prisma.tier.create({
    data: {
      tierLevel: 2,
      name: 'Shareholder',
      minAmount: 85,
      maxAmount: 169,
      isAutoAppliedBySum: true,
      perks: [
        'All Regular tier perks',
        'Quarter meetings: progression and behind the scenes — your opinions shape marketing research',
        'Special voting to create a campaign shown on the platform, with monthly aid from OMP for half a year from the second piggy bank',
        'Every $10 above $75 grants an additional vote',
        'Voting on small things like design for camp t-shirts and more',
      ],
    },
  });

  const patronTier = await prisma.tier.create({
    data: {
      tierLevel: 3,
      name: 'Patron',
      minAmount: 170,
      maxAmount: null,
      isAutoAppliedBySum: true,
      perks: [
        'All Shareholder tier perks',
        'Your name on the back of camp t-shirts in the "sponsors" section',
        'Personal thank-you on our social media — quarterly name posts and video shout-outs',
      ],
    },
  });
  console.log('  ✅ Tiers seeded');

  // ── Seed Donation Boxes ──
  await prisma.donationBox.createMany({
    data: [
      {
        title: 'One-Time Donation',
        amount: 0,
        tierDetails: 'Choose your own one-time donation amount',
        buttonText: 'Donate',
        isCustomAmount: true,
        isRecurring: false,
        isActive: true,
        displayOrder: 1,
      },
      {
        title: 'Monthly Donation',
        amount: 0,
        tierDetails: 'Choose your own monthly donation amount',
        buttonText: 'Donate',
        isCustomAmount: true,
        isRecurring: true,
        isActive: true,
        displayOrder: 2,
      },
      {
        title: 'Regular',
        amount: 10,
        tierId: regularTier.id,
        tierDetails: '', // Perks are inherited from the Regular tier
        buttonText: 'Donate $10/mo',
        isCustomAmount: false,
        isActive: true,
        displayOrder: 2,
      },
      {
        title: 'Shareholder',
        amount: 85,
        tierId: shareholderTier.id,
        tierDetails: '', // Perks are inherited from the Shareholder tier
        buttonText: 'Donate $85/mo',
        isCustomAmount: false,
        isActive: true,
        displayOrder: 3,
      },
      {
        title: 'Patron',
        amount: 170,
        tierId: patronTier.id,
        tierDetails: '', // Perks are inherited from the Patron tier
        buttonText: 'Donate $170/mo',
        isCustomAmount: false,
        isActive: true,
        displayOrder: 4,
      },
    ],
  });
  console.log('  ✅ Donation boxes seeded');

  // ── Seed Website Content ──
  await prisma.websiteContent.create({
    data: {
      head: 'Empower Communities, Transform Lives',
      subtitle: 'Your monthly donation creates lasting impact through sustainable projects worldwide',
      body: `By becoming a monthly donor, you join a movement of changemakers who believe in consistent, long-term impact. Your contribution — no matter the size — helps us plan ahead, scale our projects, and deliver measurable results to the communities we serve.\n\n10% of all donations go into our community "Piggy Banks," where you and fellow donors vote on which projects receive additional funding boosts. Together, we decide where your impact grows.`,
    },
  });
  console.log('  ✅ Website content seeded');

  // ── Seed SiteText Content (New Dynamic Fields) ──
  await prisma.siteText.deleteMany();
  await prisma.siteText.createMany({
    data: [
      // WELCOME Section
      {
        key: 'welcome_headline',
        value: 'Empower Communities, Transform Lives',
        section: 'WELCOME',
      },
      {
        key: 'welcome_subheadline',
        value: 'Your monthly donation creates lasting impact through sustainable projects worldwide',
        section: 'WELCOME',
      },
      {
        key: 'welcome_hero_intro',
        value: 'By becoming a monthly donor, you join a movement of changemakers who believe in consistent, long-term impact. Your contribution — no matter the size — helps us plan ahead, scale our projects, and deliver measurable results to the communities we serve.\n\n10% of all donations go into our community "Piggy Banks," where you and fellow donors vote on which projects receive additional funding boosts. Together, we decide where your impact grows.',
        section: 'WELCOME',
      },
      // ACTIVE_PROJECTS Section
      {
        key: 'projects_label',
        value: 'Where Your **Money** Goes',
        section: 'ACTIVE_PROJECTS',
      },
      {
        key: 'projects_title',
        value: 'Active Projects',
        section: 'ACTIVE_PROJECTS',
      },
      {
        key: 'projects_intro',
        value: 'Your donations directly fund these community-driven initiatives. Track progress and see the real impact of your contribution.',
        section: 'ACTIVE_PROJECTS',
      },
      // DONATION_BOXES Section
      {
        key: 'boxes_label',
        value: 'Make an **Impact**',
        section: 'DONATION_BOXES',
      },
      {
        key: 'boxes_title',
        value: 'Choose Your Donation',
        section: 'DONATION_BOXES',
      },
      {
        key: 'boxes_cta',
        value: 'Select a plan that works for you. Every contribution, big or small, helps fund community projects and create lasting change.',
        section: 'DONATION_BOXES',
      },
      // DONATION_TIERS Section
      {
        key: 'tiers_label',
        value: 'Your **Benefits**',
        section: 'DONATION_TIERS',
      },
      {
        key: 'tiers_title',
        value: 'Donation Tiers',
        section: 'DONATION_TIERS',
      },
      {
        key: 'tiers_intro',
        value: 'Our tiers ensure transparency and show how every dollar level supports specific community goals.',
        section: 'DONATION_TIERS',
      },
      // DONATION_ROADMAP Section
      {
        key: 'roadmap_label',
        value: 'Monthly **Rewards**',
        section: 'DONATION_ROADMAP',
      },
      {
        key: 'roadmap_title',
        value: 'Monthly Donation Roadmap',
        section: 'DONATION_ROADMAP',
      },
      {
        key: 'roadmap_intro',
        value: 'Track the path of your donation from initial funding to on-the-ground project deployment.',
        section: 'DONATION_ROADMAP',
      },
      // TANGIBLE_IMPACT Section
      {
        key: 'impact_label',
        value: 'One-Time **Objectives**',
        section: 'TANGIBLE_IMPACT',
      },
      {
        key: 'impact_title',
        value: 'Tangible Impact Objectives',
        section: 'TANGIBLE_IMPACT',
      },
      {
        key: 'impact_intro',
        value: 'We focus on clear, measurable impact metrics. See what achievements our donor community has unlocked.',
        section: 'TANGIBLE_IMPACT',
      },
      // FOOTER Section
      {
        key: 'footer_brand_name',
        value: '**OpenmindProjects**',
        section: 'FOOTER',
      },
      {
        key: 'footer_brand_desc',
        value: 'Building stronger communities through sustainable development initiatives.',
        section: 'FOOTER',
      },
      {
        key: 'footer_tagline',
        value: 'Every donation makes a difference 💜',
        section: 'FOOTER',
      },
    ],
  });
  console.log('  ✅ Dynamic site text seeded');

  // ── Seed Projects (real community programs) ──
  await prisma.projectDetail.createMany({
    data: [
      {
        projectName: 'Train The Trainer Camp',
        details:
          'A 3-month on-site camp for Southeast Asian youth (Thailand, Myanmar and Laos) building critical thinking leaders. Focuses on 21st-century skills: problem-solving, confidence, teamwork, and motivation. Themes cover SDGs, digital/AI literacy, marketing, and social impact.',
        status: 'ACTIVE',
        imageUrl: null,
        fundingGoal: 5000000, // $50,000
        fundedAmount: 1875000, // $18,750
      },
      {
        projectName: 'Active Learning Camp',
        details:
          'An intensive, hands-on innovation program equipping youth with AI, digital, and problem-solving skills through immersive 4–7 day camps and mentorship. Each camp empowers roughly 60 participants to develop 5–10 project prototypes targeting local environmental, civic, or business challenges. Following the camp, youth leverage the "OpenSkills" platform for advanced learning pathways, portfolio building, and continuous guidance to turn ideas into real solutions.',
        status: 'ACTIVE',
        imageUrl: null,
        fundingGoal: 3000000, // $30,000
        fundedAmount: 1200000, // $12,000
      },
      {
        projectName: 'Openmind.Travel',
        details:
          'A hands-on innovation program equips underprivileged Thai youth with digital, problem-solving, marketing, and English skills via 10-day camps. Forty participants design local community tourism plans to transform villages into self-reliant hotspots. Post-camp, youth use the "OpenSkills" platform for advanced learning and marketing mentorship. These community initiatives are showcased on the "Openmind Travel" platform and integrated into "Openmind Tours," an organized group travel initiative launching this year to give travelers immersive rural experiences.',
        status: 'ACTIVE',
        imageUrl: null,
        fundingGoal: 4000000, // $40,000
        fundedAmount: 2400000, // $24,000
      },
    ],
  });
  console.log('  ✅ Projects seeded');

  // ── Seed Donation Milestones (Total Money Objectives) ──
  await prisma.donationMilestone.createMany({
    data: [
      {
        amountUsd: 1020,
        label: 'Silver "OMP Friend"',
        description: 'A silver "OMP friend" certificate will be sent to your home.',
        isRepeatable: false,
        displayOrder: 1,
      },
      {
        amountUsd: 2040,
        label: 'Gold "OMP Friend"',
        description: 'A gold "OMP friend" certificate will be sent to your home.',
        isRepeatable: false,
        displayOrder: 2,
      },
      {
        amountUsd: 3060,
        label: 'Platinum "OMP Friend"',
        description: 'A platinum "OMP friend" certificate will be sent to your home.',
        isRepeatable: false,
        displayOrder: 3,
      },
      {
        amountUsd: 6000,
        label: 'Camp Patrons',
        description: '"Camp patron" certificate — a camp will be called by your name and your picture will be printed and put in the camp center.',
        isRepeatable: true,
        displayOrder: 4,
      },
      {
        amountUsd: 10000,
        label: 'Patreon Wall',
        description: 'A permanent place on OMP\'s patreon wall at the center.',
        isRepeatable: false,
        displayOrder: 5,
      },
    ],
  });
  console.log('  ✅ Donation milestones seeded');

  // Seed historical transaction records across a 2-year range to facilitate testing dashboard date filters.
  await seedHistoricalTransactions(prisma);

  // ── Retroactive migration for one-time transactions ──
  console.log('🔄 Running retroactive migration for transaction tracking flags...');
  const updateResult = await prisma.transaction.updateMany({
    where: {
      stripeInvoiceId: null,
      NOT: {
        stripePaymentIntentId: {
          startsWith: 'pi_mock_rollover_',
        },
      },
    },
    data: {
      isRecurring: false,
    },
  });
  console.log(`  ✅ Corrected ${updateResult.count} one-time transactions in database ledger.`);

  // ── Auto-assign tiers based on donation sums ──
  console.log('🔄 Running tier auto-assignment for all seeded donors...');
  const allDonors = await prisma.user.findMany({
    where: { role: 'DONOR' },
    select: { id: true, email: true },
  });
  for (const donor of allDonors) {
    await recalculateUserTiers(donor.id);
  }
  console.log(`  ✅ Auto-assigned tiers for ${allDonors.length} donors.`);

  // ── Seed manual tier overrides for hybrid testing ──
  // Assign Patron tier manually to the first two donors to test MANUAL + AUTO_SUM coexistence.
  if (allDonors.length >= 2) {
    console.log('🔄 Seeding manual tier overrides for hybrid testing...');
    await prisma.userTier.upsert({
      where: { userId_tierId: { userId: allDonors[0].id, tierId: patronTier.id } },
      create: { userId: allDonors[0].id, tierId: patronTier.id, assignedBy: 'MANUAL' },
      update: {},
    });
    await prisma.userTier.upsert({
      where: { userId_tierId: { userId: allDonors[1].id, tierId: shareholderTier.id } },
      create: { userId: allDonors[1].id, tierId: shareholderTier.id, assignedBy: 'MANUAL' },
      update: {},
    });
    console.log(`  ✅ Manual tier overrides seeded for ${allDonors[0].email} and ${allDonors[1].email}.`);
  }

  // ── Seed Default Honorary Certificate Email Template & Automation Trigger ──
  console.log('🔄 Seeding default honorary certificate email template and automation trigger...');
  const defaultCertTemplate = await prisma.emailTemplate.create({
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
          { type: 'text', x: 100, y: 490, value: 'Awarded on: {date}', fontSize: 11, color: '#9ca3af', align: 'center', width: 641 }
        ]
      }
    }
  });

  await prisma.automationTrigger.create({
    data: {
      eventName: 'MILESTONE_CLAIMED',
      emailTemplateId: defaultCertTemplate.id,
      adminAssignments: {
        create: [
          { role: 'SYSADMIN' },
          { role: 'SUPER_ADMIN' }
        ]
      }
    }
  });
  console.log('  ✅ Default template & triggers seeded');

  console.log('\n🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
