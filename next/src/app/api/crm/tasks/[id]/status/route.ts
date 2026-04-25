import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withFeature } from '@/lib/middlewares/auth';
import { Task } from '@/lib/models';
import dbConnect from '@/lib/db-connect';

export const PATCH = withFeature('CRM', async (req: NextRequest, { workspace, params }: any) => {
  try {
    const { id } = await params;
    const { status } = await req.json();
    
    await dbConnect();

    const task = await Task.findOneAndUpdate(
      { _id: id, workspace: workspace._id },
      { status },
      { returnDocument: 'after' }
    );

    if (!task) {
      return NextResponse.json({ success: false, message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: task });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
