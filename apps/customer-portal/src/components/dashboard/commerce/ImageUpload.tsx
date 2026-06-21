"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadMedia } from '@/lib/api/inbox';
import { toast } from 'sonner';

interface ImageUploadProps {
  onUpload: (url: string) => void;
  folder?: string;
  className?: string;
}

export function ImageUpload({ onUpload, folder = 'commerce/products', className }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (JPG, PNG, etc)");
      return;
    }

    setIsUploading(true);
    setProgress(10);
    
    try {
      // We'll simulate progress since standard fetch/axios doesn't give us easy progress without config
      const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 10 : prev));
      }, 200);

      const data: any = await uploadMedia(file, folder);

      clearInterval(interval);
      setProgress(100);

      if (data && data.success) {
        onUpload(data.url);
        toast.success("Image uploaded to cloud.");
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err: any) {
      console.error("[UPLOAD_ERROR]:", err);
      toast.error(err.message || "Failed to upload image.");
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
      }, 500);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={onButtonClick}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "relative h-40 rounded-[32px] border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-2 group",
          isDragging ? "border-primary bg-primary/5" : "border-border/40 bg-card/30 hover:border-primary/40 hover:bg-primary/5",
          isUploading && "pointer-events-none opacity-80"
        )}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onFileSelect} 
          className="hidden" 
          accept="image/*"
        />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div 
              key="uploading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                 <Loader2 className="size-8 text-primary animate-spin" />
                 <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black">{progress}%</div>
              </div>
              <div className="text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Uploading to Cloud</p>
                 <p className="text-[8px] font-bold opacity-40 uppercase tracking-tighter">Securing visual assets...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className={cn(
                "p-4 rounded-2xl transition-colors",
                isDragging ? "bg-primary text-white" : "bg-card text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                 <Upload className="size-6" />
              </div>
              <div className="text-center px-4">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em]">Drop Product Image</p>
                 <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest mt-1">or click to browse library</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar background */}
        {isUploading && (
           <div className="absolute bottom-0 left-0 h-1 bg-primary/10 w-full">
              <motion.div 
                className="h-full bg-primary" 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
           </div>
        )}
      </motion.div>
      
      <p className="text-[9px] font-medium text-muted-foreground/60 px-4 flex items-center gap-2">
         <AlertCircle className="size-3" />
         Auto-optimized for WhatsApp storefronts. (Max 5MB)
      </p>
    </div>
  );
}
