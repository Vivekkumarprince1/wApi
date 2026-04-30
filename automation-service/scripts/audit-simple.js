const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://whats-api-automation:Prince123@cluster0.dtvexe1.mongodb.net/wa_automation?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        const db = client.db("wa_automation");

        const rules = await db.collection("automationrules").find({}).limit(5).toArray();
        console.log("\n--- Automation Rules ---");
        rules.forEach(r => {
            console.log(`Rule: ${r.name} | Workspace: ${r.workspace} | Type: ${typeof r.workspace}`);
        });

        const settings = await db.collection("answerbotsettings").find({}).limit(5).toArray();
        console.log("\n--- AnswerBot Settings ---");
        settings.forEach(s => {
            console.log(`Settings ID: ${s._id} | Workspace: ${s.workspace} | Type: ${typeof s.workspace}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

run();
