"use client";

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Signal, Wifi, Battery, ChevronLeft, Video, Phone, MoreVertical, Paperclip, Camera, Mic, CheckCheck } from 'lucide-react';
import { WhatsAppBubble } from './WhatsAppBubble';

interface DeviceSimulatorProps {
  template?: any;
  variableMapping?: any;
  mediaUrl?: string;
  contactName?: string;
}

export function DeviceSimulator({
  template,
  variableMapping,
  mediaUrl,
  contactName = "Customer"
}: DeviceSimulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values for 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative mx-auto w-full max-w-[160px] xl:max-w-[180px] perspective-[900px]"
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        {/* Minimal Glow */}
        <div className="absolute -inset-1.5 bg-primary/5 rounded-[12px] blur-[15px] opacity-10 pointer-events-none" />

        {/* iPhone 15 Pro Titanium Frame */}
        <div className="relative bg-[#0d0d0d] rounded-[16px] p-0.5 shadow-[0_10px_20px_-6px_rgba(0,0,0,0.5)] border-[1px] border-white/10 overflow-hidden">

          {/* Bezel Gloss Reflection */}
          <div className="absolute inset-0 rounded-[16px] bg-gradient-to-tr from-white/5 via-transparent to-white/5 pointer-events-none" />

          {/* Screen Content */}
          <div className="relative bg-[#efeae2] dark:bg-[#0b141a] rounded-[14px] overflow-hidden aspect-[9/19] flex flex-col shadow-inner">

            {/* Screen Glare Overlay */}
            <motion.div
              style={{
                translateX: useTransform(mouseXSpring, [-0.5, 0.5], ["-50%", "50%"]),
                translateY: useTransform(mouseYSpring, [-0.5, 0.5], ["-50%", "50%"]),
              }}
              className="absolute inset-[-100%] bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none z-50 opacity-40 blur-3xl"
            />

            {/* Dynamic Island */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60px] h-[20px] bg-black rounded-b-[12px] z-[60] flex items-center justify-center border-b border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1a1a1a] ml-auto mr-4" />
            </div>

            {/* Status Bar */}
            <div className="h-8 flex items-center justify-between px-4 pt-3">
              <span className="text-[9px] font-bold text-slate-900 dark:text-white tracking-tight">9:41</span>
              <div className="flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                <Wifi className="h-3.5 w-3.5 text-slate-900 dark:text-white" />
                <div className="w-6 h-3 rounded-sm border border-slate-900/30 dark:border-white/30 p-[1px] flex items-center">
                  <div className="h-full w-[80%] bg-slate-900 dark:bg-white rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* WhatsApp Interface Wrapper */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-[#f0f2f5]/90 dark:bg-[#202c33]/90 backdrop-blur-md px-1.5 py-1 flex items-center gap-1 shadow-sm relative z-40 border-b border-black/5 dark:border-white/5">
                <ChevronLeft className="h-4 w-4 text-[#007aff] dark:text-[#53bdeb] font-semibold" />
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 border border-black/5 flex items-center justify-center overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${contactName}&backgroundColor=b6e3f4`} alt="Avatar" className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-bold text-slate-900 dark:text-white truncate tracking-tight">
                    {contactName}
                  </h4>
                  <p className="text-[8px] text-[#00a884] font-medium leading-none mt-0.5">
                    online
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[#007aff] dark:text-[#53bdeb]">
                  <Video className="h-3 w-3" />
                  <Phone className="h-3 w-3" />
                  <MoreVertical className="h-3 w-3 text-slate-500" />
                </div>
              </div>

              {/* Chat Canvas */}
              <div className="flex-1 relative overflow-y-auto no-scrollbar bg-[#efeae2] dark:bg-[#0b141a]">
                <div className="absolute inset-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none"
                  style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: '500px' }}
                />

                <div className="flex justify-center my-2 relative z-10">
                  <span className="px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-[#1d282f]/80 backdrop-blur-sm text-[7px] font-black text-slate-500 dark:text-[#8696a0] shadow-sm uppercase tracking-[0.1em] border border-black/5">
                    Today
                  </span>
                </div>

                <div className="px-1.5 pb-3 space-y-2 relative z-10">
                  <AnimatePresence mode="wait">
                    {template ? (
                      <motion.div
                        key={template._id || template.id}
                        initial={{ opacity: 0, y: 30, scale: 0.9, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                      >
                        <WhatsAppBubble
                          template={template}
                          variableMapping={variableMapping}
                          mediaUrl={mediaUrl}
                        />
                      </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-30">
                        <div className="relative">
                          <Signal className="h-8 w-8 text-slate-400" />
                          <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-primary/20 rounded-full"
                          />
                        </div>
                        <p className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500 leading-relaxed">
                          Waiting for<br />Signal Input
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Chat Input Area */}
              <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-1.5 px-2 flex items-center gap-2 relative z-40">
                <div className="flex gap-2 text-[#007aff] dark:text-[#53bdeb]">
                  <Paperclip className="h-4 w-4 rotate-45" />
                </div>
                <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-full px-2 py-1 text-[11px] text-slate-400 border border-black/5 dark:border-none">
                  Message
                </div>
                <div className="flex items-center gap-2 text-[#007aff] dark:text-[#53bdeb]">
                  <Camera className="h-4 w-4" />
                  <Mic className="h-4 w-4" />
                </div>
              </div>

              {/* iOS Home Indicator */}
              <div className="h-6 flex justify-center items-end pb-1 bg-[#f0f2f5] dark:bg-[#202c33]">
                <div className="w-[80px] h-[3px] bg-slate-900/20 dark:bg-white/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
