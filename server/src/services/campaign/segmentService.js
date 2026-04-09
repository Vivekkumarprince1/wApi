const { Segment, Contact } = require('../../models');

/**
 * Segment Service
 * Handles resolution of dynamic segments into contact lists
 */

/**
 * Resolve a segment ID into a list of contact IDs
 * @param {ObjectId} workspaceId 
 * @param {ObjectId} segmentId 
 * @returns {Array<ObjectId>}
 */
async function resolveSegmentContacts(workspaceId, segmentId) {
  const segment = await Segment.findOne({ _id: segmentId, workspace: workspaceId });
  if (!segment) return [];
  
  const query = { workspace: workspaceId, optedOut: { $ne: true } };
  
  if (segment.filters.tags?.length > 0) {
    query.tags = { $in: segment.filters.tags };
  }
  
  if (segment.filters.notTags?.length > 0) {
    query.tags = { ...query.tags, $nin: segment.filters.notTags };
  }
  
  // Custom Query support (Risk: Sanitization required for prod)
  if (segment.filters.customQuery) {
    Object.assign(query, segment.filters.customQuery);
  }
  
  const contacts = await Contact.find(query).distinct('_id');
  return contacts;
}

/**
 * Get the count of contacts in a segment or raw filter
 * @param {ObjectId} workspaceId 
 * @param {Object} filters 
 */
async function getSegmentCount(workspaceId, filters) {
  const query = { workspace: workspaceId, optedOut: { $ne: true } };
  
  if (filters.tags?.length > 0) {
    query.tags = { $in: filters.tags };
  }
  
  if (filters.notTags?.length > 0) {
    query.tags = { ...query.tags, $nin: filters.notTags };
  }
  
  return await Contact.countDocuments(query);
}

module.exports = {
  resolveSegmentContacts,
  getSegmentCount
};
