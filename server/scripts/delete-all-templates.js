/**
 * SCRIPT TO DELETE ALL TEMPLATES
 * 
 * This script connects to the database and deletes all documents 
 * from the Templates and TemplateMetrics collections.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Import models
const { Template, TemplateMetric } = require('../src/models');

async function deleteAllTemplates() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('ERROR: MONGODB_URI not found in .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected successfully.\n');

    // 1. Delete TemplateMetrics
    console.log('Deleting TemplateMetrics...');
    const metricResult = await TemplateMetric.deleteMany({});
    console.log(`Successfully deleted ${metricResult.deletedCount} metrics.`);

    // 2. Delete Templates
    console.log('Deleting Templates...');
    const templateResult = await Template.deleteMany({});
    console.log(`Successfully deleted ${templateResult.deletedCount} templates.`);

    console.log('\nAll templates and metrics have been removed from the database.');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    process.exit(1);
  }
}

deleteAllTemplates();
