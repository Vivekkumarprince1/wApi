require('dotenv').config();
const mongoose = require("mongoose");
const ContactSettings = require("./src/models/messaging/ContactSettings");

mongoose.connect(process.env.MONGODB_URI, {})
  .then(async () => {
    const defaultWorkspace = "699c21048e96ba1b49ab6945";
    const settings = await ContactSettings.findOne({ workspace: defaultWorkspace });
    console.log("Settings document:", JSON.stringify(settings, null, 2));
    process.exit(0);
  })
  .catch(console.error);
