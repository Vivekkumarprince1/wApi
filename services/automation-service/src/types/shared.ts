import { Types } from 'mongoose';

export interface IWorkspace {
  _id: Types.ObjectId | string;
  name?: string;
  [key: string]: any;
}

export interface IContact {
  _id: Types.ObjectId | string;
  phone?: string;
  name?: string;
  [key: string]: any;
}

export interface IConversation {
  _id: Types.ObjectId | string;
  workspace: Types.ObjectId | string;
  contact: Types.ObjectId | string;
  [key: string]: any;
}
