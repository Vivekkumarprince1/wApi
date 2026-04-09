const { Segment, Contact } = require('../../models');

/**
 * Segment Controller
 * Handles dynamic audience segmentation logic
 */

// List segments
exports.listSegments = async (req, res) => {
  try {
    const segments = await Segment.find({ workspace: req.user.workspace }).sort({ createdAt: -1 });
    res.json({ success: true, segments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create segment
exports.createSegment = async (req, res) => {
  try {
    const { name, description, filters } = req.body;
    
    // Calculate initial count
    const count = await exports.resolveSegmentCount(req.user.workspace, filters);
    
    const segment = await Segment.create({
      workspace: req.user.workspace,
      name,
      description,
      filters,
      contactCount: count,
      lastResolvedAt: new Date(),
      createdBy: req.user._id
    });
    
    res.status(201).json({ success: true, segment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Helper: Resolve segment count
exports.resolveSegmentCount = async (workspaceId, filters) => {
  const query = { workspace: workspaceId };
  
  if (filters.tags?.length > 0) {
    query.tags = { $in: filters.tags };
  }
  
  if (filters.notTags?.length > 0) {
    query.tags = { ...query.tags, $nin: filters.notTags };
  }
  
  // Extendable logic for other filters (status, activity, etc.)
  
  return await Contact.countDocuments(query);
};

// Helper: Resolve segment contact IDs
exports.resolveSegmentContacts = async (workspaceId, segmentId) => {
  const segment = await Segment.findById(segmentId);
  if (!segment) return [];
  
  const query = { workspace: workspaceId };
  if (segment.filters.tags?.length > 0) {
    query.tags = { $in: segment.filters.tags };
  }
  if (segment.filters.notTags?.length > 0) {
    query.tags = { ...query.tags, $nin: segment.filters.notTags };
  }
  
  const contacts = await Contact.find(query).distinct('_id');
  return contacts;
};
