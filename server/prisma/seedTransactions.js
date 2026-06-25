import { PrismaClient } from '@prisma/client';

/**
 * Seed historical transactions spanning the last 2 years, with exactly 3 transactions per month.
 * 
 * Why? Ensures a clean, predictable distribution of transaction records (exactly 3 per month)
 * to simplify verification of pagination, date-filtering boundaries, and dashboard metrics.
 * 
 * @param {PrismaClient} prisma - Prisma Client instance.
 */
export async function seedHistoricalTransactions(prisma) {
  console.log('🔄 Seeding historical users and exactly 3 transactions per month (past 2 years)...');

  // Define donors with start offsets (months in the past) and subscription tiers
  const donorsConfig = [
    { email: 'alice.smith@example.com', firstName: 'Alice', lastName: 'Smith', country: 'United States', monthlyAmount: 85, startMonthsAgo: 24 },
    { email: 'bob.johnson@example.com', firstName: 'Bob', lastName: 'Johnson', country: 'United Kingdom', monthlyAmount: 10, startMonthsAgo: 20 },
    { email: 'charlie.brown@example.com', firstName: 'Charlie', lastName: 'Brown', country: 'Canada', monthlyAmount: 170, startMonthsAgo: 18 },
    { email: 'diana.prince@example.com', firstName: 'Diana', lastName: 'Prince', country: 'United States', monthlyAmount: 25, startMonthsAgo: 15 },
    { email: 'evan.wright@example.com', firstName: 'Evan', lastName: 'Wright', country: 'Australia', monthlyAmount: 50, startMonthsAgo: 12 },
    { email: 'fiona.gallagher@example.com', firstName: 'Fiona', lastName: 'Gallagher', country: 'Ireland', monthlyAmount: 85, startMonthsAgo: 10 },
    { email: 'george.clooney@example.com', firstName: 'George', lastName: 'Clooney', country: 'United States', monthlyAmount: 0, startMonthsAgo: 8 },
    { email: 'hannah.abbott@example.com', firstName: 'Hannah', lastName: 'Abbott', country: 'United Kingdom', monthlyAmount: 10, startMonthsAgo: 6 },
    { email: 'ian.malcolm@example.com', firstName: 'Ian', lastName: 'Malcolm', country: 'New Zealand', monthlyAmount: 170, startMonthsAgo: 4 },
    { email: 'julia.roberts@example.com', firstName: 'Julia', lastName: 'Roberts', country: 'United States', monthlyAmount: 85, startMonthsAgo: 2 }
  ];

  const now = new Date('2026-06-22T12:00:00Z');

  // 1. Create donor users
  const createdDonors = [];
  for (const conf of donorsConfig) {
    const joinDate = new Date(now);
    joinDate.setMonth(now.getMonth() - conf.startMonthsAgo);

    const user = await prisma.user.create({
      data: {
        email: conf.email,
        firstName: conf.firstName,
        lastName: conf.lastName,
        country: conf.country,
        role: 'DONOR',
        monthlyAmount: conf.monthlyAmount,
        stripeCustomerId: `cus_mock_${Math.random().toString(36).substring(2, 10)}`,
        createdAt: joinDate,
        isActive: true,
      }
    });
    createdDonors.push(user);
  }

  // 2. Generate exactly 3 transactions per month
  const transactionsData = [];
  
  // Loop through last 24 months (from 24 months ago to current month 0)
  for (let m = 24; m >= 0; m--) {
    for (let t = 0; t < 3; t++) {
      const txDate = new Date(now);
      txDate.setMonth(now.getMonth() - m);
      
      // Distribute transactions across days 5, 15, and 25 of the month to look natural
      const day = t === 0 ? 5 : t === 1 ? 15 : 25;
      txDate.setDate(day);
      txDate.setHours(9 + t * 3, 30, 0, 0);

      // Select a random donor
      const donor = createdDonors[Math.floor(Math.random() * createdDonors.length)];
      
      // Alternate recurring vs one-time based on the donor's subscription configuration
      const isRecurring = donor.monthlyAmount > 0 && Math.random() > 0.25;
      const amount = isRecurring ? donor.monthlyAmount * 100 : [15, 30, 50, 100][Math.floor(Math.random() * 4)] * 100;

      const randomVal = Math.random();
      let status = 'SUCCEEDED';
      if (randomVal < 0.03) {
        status = 'FAILED';
      } else if (randomVal < 0.05) {
        status = 'REFUNDED';
      }

      transactionsData.push({
        userId: donor.id,
        stripeInvoiceId: isRecurring ? `in_mock_${m}_${t}_${Math.random().toString(36).substring(2, 6)}` : null,
        stripePaymentIntentId: `pi_mock_${m}_${t}_${Math.random().toString(36).substring(2, 6)}`,
        amount: amount,
        status: status,
        isRecurring: isRecurring,
        subject: !isRecurring && Math.random() > 0.5 ? 'Special Project Fund' : null,
        adminNote: null,
        createdAt: txDate,
      });
    }
  }

  // 3. Sort chronologically and insert
  transactionsData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const tx of transactionsData) {
    await prisma.transaction.create({
      data: tx
    });
  }

  console.log(`  ✅ Successfully seeded ${createdDonors.length} donors and exactly ${transactionsData.length} historical transactions (3 per month).`);
}
