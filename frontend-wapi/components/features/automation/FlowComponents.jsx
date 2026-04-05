import React from 'react';

/**
 * WorkflowCanvas component - The workspace for the visual builder
 */
export const WorkflowCanvas = ({ children }) => {
  return (
    <div className="relative w-full min-h-[600px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden p-8 flex flex-col items-center gap-0">
      {/* Grid background effect */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* Content wrapper */}
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center">
        {children}
      </div>
    </div>
  );
};

/**
 * FlowNode component - Base card for triggers, conditions, and actions
 */
export const FlowNode = ({ 
  type = 'action', 
  title, 
  icon: Icon, 
  children, 
  status = 'valid',
  onRemove,
  onClick
}) => {
  const typeStyles = {
    trigger: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    condition: 'border-amber-500 bg-amber-50 text-amber-900',
    action: 'border-blue-500 bg-blue-50 text-blue-900',
    logic: 'border-violet-500 bg-violet-50 text-violet-900'
  };

  const iconColors = {
    trigger: 'text-emerald-600',
    condition: 'text-amber-600',
    action: 'text-blue-600',
    logic: 'text-violet-600'
  };

  return (
    <div 
      className={`group relative w-full mb-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-md cursor-pointer ${typeStyles[type]}`}
      onClick={onClick}
    >
      {/* Node Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-white/50 ${iconColors[type]}`}>
            {Icon && <Icon size={18} />}
          </div>
          <span className="font-semibold text-sm uppercase tracking-wider">{title}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {status === 'incomplete' && (
            <span className="flex h-2 w-2 rounded-full bg-red-500" title="Incomplete configuration" />
          )}
          {onRemove && (
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 rounded text-slate-500 transition-opacity"
            >
              <svg size={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Node Content */}
      <div className="p-4 bg-white/30 text-sm">
        {children}
      </div>

      {/* Bottom Connector Point */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-inherit bg-white z-20" />
    </div>
  );
};

/**
 * NodeConnector component - The visual line between nodes
 */
export const NodeConnector = () => {
  return (
    <div className="w-0.5 h-10 bg-slate-300 relative my-[-4px]">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-300" />
    </div>
  );
};
