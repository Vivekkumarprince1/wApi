declare module 'next/server' {
  export const NextResponse: any;
  export const NextRequest: any;
  export type NextRequest = any;
  export type NextResponse = any;
}

declare module 'cloudinary' {
  export const v2: any;
  export default v2;
}

declare module 'clsx' {
  export function clsx(...args: any[]): string;
  export type ClassValue = any;
}

declare module 'tailwind-merge' {
  export function twMerge(...args: any[]): string;
}

declare module 'lucide-react' {
  const anyExport: any;
  export = anyExport;
}

declare module '@/modelsUser' {
  const anyExport: any;
  export = anyExport;
}

declare module '@/models-models' {
  const anyExport: any;
  export = anyExport;
}

declare module '@/models-admin/WebhookPolicy' {
  const anyExport: any;
  export = anyExport;
}
