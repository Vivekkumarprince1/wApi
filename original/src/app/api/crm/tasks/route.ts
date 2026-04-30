import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import { Task, Deal, Contact } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

export const GET = withFeature('TASKS', async (req: NextRequest, { workspace }) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const dealId = searchParams.get('dealId');
    const assigneeId = searchParams.get('assigneeId');

    await dbConnect();

    const query: any = { workspace: workspace?._id };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (dealId) query.relatedDeal = dealId;
    if (assigneeId) query.assignee = assigneeId;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate({ path: 'relatedContact', select: 'name phone avatar' })
      .populate({ path: 'relatedDeal', select: 'title' })
      .populate({ path: 'assignee', select: 'name email avatar' })
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: tasks });
  } catch (err: any) {
    console.error("[Tasks API GET Detailed Error]:", err);
    return NextResponse.json({ 
      success: false, 
      message: err.message, 
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    }, { status: 500 });
  }
});

export const POST = withFeature('TASKS', async (req: NextRequest, { workspace, user }) => {
  try {
    const body = await req.json();
    await dbConnect();

    const taskData = {
      ...body,
      workspace: workspace._id,
      assignee: body.assigneeId || body.assignee || user._id,
      relatedDeal: body.relatedDeal || body.deal,
      relatedContact: body.relatedContact || body.contact
    };

    const task = await Task.create(taskData);

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (err: any) {
    console.error("[Tasks API POST Error]:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
