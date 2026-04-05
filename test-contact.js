const mongoose = require("mongoose");
const { Contact } = require("./server/src/models");

mongoose.connect("mongodb://localhost:27017/wApi", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const defaultWorkspace = "699c21048e96ba1b49ab6945";
    const contactId = "69bf0f3043aded99b678c774";
    const contact = await Contact.findById(contactId);
    console.log("Contact:", contact);
    if (contact) {
      console.log("Workspace matches?", contact.workspace.toString() === defaultWorkspace);
    }
    process.exit(0);
  })
  .catch(console.error);
