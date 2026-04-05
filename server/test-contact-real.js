require('dotenv').config();
const mongoose = require("mongoose");
const { Contact } = require("./src/models");

mongoose.connect(process.env.MONGODB_URI, {})
  .then(async () => {
    const defaultWorkspace = "699c21048e96ba1b49ab6945";
    const contactId = "69bf0f3043aded99b678c774";
    const contact = await Contact.findById(contactId);
    console.log("Contact document:", contact);
    if (contact) {
      console.log("Workspace ID:", contact.workspace);
      console.log("Workspace match?", contact.workspace?.toString() === defaultWorkspace);
    }
    process.exit(0);
  })
  .catch(console.error);
