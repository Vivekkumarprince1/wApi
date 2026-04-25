const Razorpay = require('razorpay');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testCreatePlan() {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    console.log('Using Keys:', process.env.RAZORPAY_KEY_ID);

    const planOptions = {
      period: 'monthly',
      interval: 1,
      item: {
        name: " Starter Plan", // With leading space as in user DB
        amount: 20000,
        currency: 'INR',
        description: "Platform subscription:  Starter"
      }
    };

    console.log('Sending Plan Options:', JSON.stringify(planOptions, null, 2));
    const result = await razorpay.plans.create(planOptions);
    console.log('Success:', result.id);
  } catch (err) {
    console.error('FAILED with error:', err);
    if (err.error) console.error('Details:', JSON.stringify(err.error, null, 2));
  }
}

testCreatePlan();
