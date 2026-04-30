import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FAQ } from '../models';

export const getFaqs = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const { status, search } = req.query;

    const query: any = { workspace: workspaceId };
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    const faqs = await FAQ.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: faqs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createFaq = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const faq = await FAQ.create({
      ...req.body,
      workspace: workspaceId
    });
    res.status(201).json({ success: true, data: faq });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateFaq = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const faq = await FAQ.findOneAndUpdate(
      { _id: id, workspace: workspaceId },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!faq) return res.status(404).json({ success: false, error: 'FAQ not found' });
    res.json({ success: true, data: faq });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteFaq = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspace?.id;
    const faq = await FAQ.findOneAndDelete({ _id: id, workspace: workspaceId });
    if (!faq) return res.status(404).json({ success: false, error: 'FAQ not found' });
    res.json({ success: true, data: { message: 'FAQ deleted' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const approveFaqs = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.workspace?.id;
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'IDs array required' });
    }

    await FAQ.updateMany(
      { _id: { $in: ids }, workspace: workspaceId },
      { $set: { status: 'approved' } }
    );

    res.json({ success: true, message: 'FAQs approved' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const generateFaqs = async (req: AuthRequest, res: Response) => {
  try {
    // Placeholder for AI generation logic
    // In a real scenario, this would trigger a background job to scrape sources and generate FAQs
    res.json({ 
      success: true, 
      message: 'FAQ generation started in background' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
