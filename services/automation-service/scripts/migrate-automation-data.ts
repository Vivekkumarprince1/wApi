import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { 
  AutomationRule, 
  AiIntentMatchLog, 
  AutoReply, 
  AutoReplyLog, 
  AutomationExecution, 
  WorkflowExecution,
  AnswerBotSettings,
  AnswerBotSource,
  AutomationAuditLog,
  InteraktiveList
} from '../src/models';

dotenv.config();

const SOURCE_URI = process.env.SOURCE_MONGODB_URI || 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/test?appName=Cluster0';
const TARGET_URI = process.env.MONGODB_URI_AUTOMATION || 'mongodb+srv://vivekkumarprince1_db_user:Prince1%40@cluster0.pitq9de.mongodb.net/wa_automation?appName=Cluster0';

async function migrateCollection(model: any, collectionName: string, sourceConn: mongoose.Connection) {
  console.log(`Migrating ${collectionName}...`);
  
  const sourceModel = sourceConn.model(model.modelName, model.schema, collectionName);
  const data = await sourceModel.find({}).lean();
  
  if (data.length === 0) {
    console.log(`No data found for ${collectionName}. Skipping.`);
    return;
  }

  console.log(`Found ${data.length} records in ${collectionName}. Inserting into target...`);
  
  // Clear target collection first to avoid duplicates in this run
  await model.deleteMany({});
  await model.insertMany(data);
  
  console.log(`Successfully migrated ${data.length} records for ${collectionName}.`);
}

async function runMigration() {
  try {
    // Connect to Target (using the app's default connection)
    await mongoose.connect(TARGET_URI);
    console.log('Connected to TARGET database');

    // Connect to Source
    const sourceConn = mongoose.createConnection(SOURCE_URI);
    await new Promise((resolve) => sourceConn.once('open', resolve));
    console.log('Connected to SOURCE database');

    const collections = [
      { model: AutomationRule, name: 'automationrules' },
      { model: AiIntentMatchLog, name: 'aiintentmatchlogs' },
      { model: AutoReply, name: 'autoreplies' },
      { model: AutoReplyLog, name: 'autoreplylogs' },
      { model: AutomationExecution, name: 'automationexecutions' },
      { model: WorkflowExecution, name: 'workflowexecutions' },
      { model: AnswerBotSettings, name: 'answerbotsettings' },
      { model: AnswerBotSource, name: 'answerbotsources' },
      { model: AutomationAuditLog, name: 'automationAuditLogs' },
      { model: InteraktiveList, name: 'interaktivelists' }
    ];

    for (const col of collections) {
      await migrateCollection(col.model, col.name, sourceConn);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
