import { Types } from 'mongoose';
import { Contact, Tag } from '../../models';

export class ContactService {
  /**
   * Add a tag to a contact
   */
  static async addTag(workspaceId: string | Types.ObjectId, contactId: string | Types.ObjectId, tagId: string | Types.ObjectId) {
    const contact = await Contact.findOne({ _id: contactId, workspace: workspaceId });
    if (!contact) throw new Error('CONTACT_NOT_FOUND');

    const tag = await Tag.findOne({ _id: tagId, workspace: workspaceId });
    if (!tag) throw new Error('TAG_NOT_FOUND');

    if (!contact.tags.includes(tagId as any)) {
      contact.tags.push(tagId as any);
      await contact.save();
    }

    return contact;
  }

  /**
   * Remove a tag from a contact
   */
  static async removeTag(workspaceId: string | Types.ObjectId, contactId: string | Types.ObjectId, tagId: string | Types.ObjectId) {
    const contact = await Contact.findOne({ _id: contactId, workspace: workspaceId });
    if (!contact) throw new Error('CONTACT_NOT_FOUND');

    contact.tags = contact.tags.filter(t => t.toString() !== tagId.toString());
    await contact.save();

    return contact;
  }
}
