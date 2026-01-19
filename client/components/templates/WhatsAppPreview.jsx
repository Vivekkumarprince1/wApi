/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHATSAPP PREVIEW COMPONENT
 * 
 * Renders a live preview of the template as it would appear in WhatsApp.
 * Mimics the exact WhatsApp UI for realistic template preview.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { 
  FaImage, 
  FaVideo, 
  FaFileAlt, 
  FaPlay, 
  FaPhone, 
  FaExternalLinkAlt, 
  FaCopy,
  FaCheck 
} from 'react-icons/fa';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Replace variable placeholders with example values
 */
function replaceVariables(text, examples = []) {
  if (!text) return '';
  
  let result = text;
  const matches = text.match(/\{\{(\d+)\}\}/g) || [];
  
  matches.forEach((match, index) => {
    const exampleValue = examples[index] || `[Variable ${index + 1}]`;
    result = result.replace(match, exampleValue);
  });
  
  return result;
}

/**
 * Format text with WhatsApp styling
 */
function formatWhatsAppText(text) {
  if (!text) return '';
  
  // Bold: *text*
  let formatted = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  // Italic: _text_
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Strikethrough: ~text~
  formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');
  // Monospace: ```text```
  formatted = formatted.replace(/```([^`]+)```/g, '<code>$1</code>');
  
  return formatted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const WhatsAppPreview = ({ template, className = '' }) => {
  const { header, body, footer, buttons } = template;
  
  // Get current time for preview
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Phone Frame */}
      <div className="flex flex-col h-full bg-gray-100 rounded-2xl overflow-hidden border-4 border-gray-800 shadow-xl max-w-[320px] mx-auto">
        
        {/* WhatsApp Header */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold">W</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm">WhatsApp Preview</div>
            <div className="text-xs text-white/70">Template Message</div>
          </div>
        </div>

        {/* Chat Background */}
        <div 
          className="flex-1 p-3 overflow-y-auto"
          style={{ 
            backgroundColor: '#e5ddd5',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5beb3' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` 
          }}
        >
          {/* Message Bubble */}
          <div className="bg-white rounded-lg shadow-sm max-w-[280px] ml-auto">
            
            {/* Header Section */}
            {header?.enabled && header.format !== 'NONE' && (
              <div className="mb-0">
                {/* Text Header */}
                {header.format === 'TEXT' && header.text && (
                  <div className="px-3 pt-2 pb-1">
                    <p 
                      className="font-semibold text-gray-900 text-[15px]"
                      dangerouslySetInnerHTML={{ 
                        __html: formatWhatsAppText(replaceVariables(header.text, [header.example])) 
                      }}
                    />
                  </div>
                )}
                
                {/* Image Header */}
                {header.format === 'IMAGE' && (
                  <div className="relative">
                    {header.mediaUrl ? (
                      <img 
                        src={header.mediaUrl} 
                        alt="Header" 
                        className="w-full h-40 object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-gray-200 to-gray-300 rounded-t-lg flex items-center justify-center">
                        <FaImage className="text-gray-400 text-4xl" />
                      </div>
                    )}
                  </div>
                )}
                
                {/* Video Header */}
                {header.format === 'VIDEO' && (
                  <div className="relative">
                    {header.mediaUrl ? (
                      <video 
                        src={header.mediaUrl} 
                        className="w-full h-40 object-cover rounded-t-lg"
                        poster=""
                      />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-gray-200 to-gray-300 rounded-t-lg flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                          <FaPlay className="text-gray-600 ml-1" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                      <FaVideo className="inline mr-1" />
                      Video
                    </div>
                  </div>
                )}
                
                {/* Document Header */}
                {header.format === 'DOCUMENT' && (
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-3">
                      <div className="w-10 h-12 bg-red-500 rounded flex items-center justify-center">
                        <FaFileAlt className="text-white text-lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {header.filename || 'document.pdf'}
                        </p>
                        <p className="text-xs text-gray-500">PDF Document</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Body Section */}
            <div className="px-3 py-2">
              <p 
                className="text-gray-800 text-[14px] leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: formatWhatsAppText(replaceVariables(body?.text || '', body?.examples || [])) 
                }}
              />
            </div>

            {/* Footer Section */}
            {footer?.enabled && footer.text && (
              <div className="px-3 pb-2">
                <p className="text-[12px] text-gray-500">{footer.text}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center justify-end px-3 pb-2 gap-1">
              <span className="text-[11px] text-gray-400">{currentTime}</span>
              <FaCheck className="text-[10px] text-blue-500" />
              <FaCheck className="text-[10px] text-blue-500 -ml-1.5" />
            </div>

            {/* Buttons Section */}
            {buttons?.enabled && buttons.items?.length > 0 && (
              <div className="border-t border-gray-200">
                {buttons.items.map((button, index) => (
                  <div 
                    key={index}
                    className="border-b border-gray-200 last:border-b-0"
                  >
                    <button className="w-full py-2.5 px-4 text-[#00a5f4] text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50">
                      {/* Button Icon */}
                      {button.type === 'URL' && <FaExternalLinkAlt className="text-xs" />}
                      {button.type === 'PHONE_NUMBER' && <FaPhone className="text-xs" />}
                      {button.type === 'COPY_CODE' && <FaCopy className="text-xs" />}
                      
                      {/* Button Text */}
                      <span>{button.text || `Button ${index + 1}`}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Info */}
          <div className="text-center mt-3">
            <span className="inline-block bg-white/80 text-gray-600 text-xs px-3 py-1 rounded-full">
              Template Message Preview
            </span>
          </div>
        </div>
      </div>

      {/* Preview Info */}
      <div className="mt-4 text-center text-xs text-gray-500 space-y-1">
        <p>This is a preview of how your template will appear</p>
        <p className="text-gray-400">Actual appearance may vary slightly on different devices</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT PREVIEW (For List View)
// ═══════════════════════════════════════════════════════════════════════════════

export const WhatsAppPreviewCompact = ({ template, className = '' }) => {
  const { header, body, buttons } = template;
  
  return (
    <div className={`bg-[#e5ddd5] rounded-lg p-3 ${className}`}>
      <div className="bg-white rounded-lg shadow-sm max-w-full">
        {/* Header Preview */}
        {header?.enabled && header.format !== 'NONE' && (
          <div className="text-sm">
            {header.format === 'TEXT' && (
              <p className="px-3 pt-2 font-semibold text-gray-900 truncate">{header.text}</p>
            )}
            {header.format === 'IMAGE' && (
              <div className="h-20 bg-gray-200 rounded-t flex items-center justify-center">
                <FaImage className="text-gray-400" />
              </div>
            )}
            {header.format === 'VIDEO' && (
              <div className="h-20 bg-gray-200 rounded-t flex items-center justify-center">
                <FaVideo className="text-gray-400" />
              </div>
            )}
            {header.format === 'DOCUMENT' && (
              <div className="h-12 bg-gray-100 rounded-t flex items-center justify-center gap-2">
                <FaFileAlt className="text-red-500" />
                <span className="text-xs text-gray-600">Document</span>
              </div>
            )}
          </div>
        )}
        
        {/* Body Preview */}
        <div className="px-3 py-2">
          <p className="text-gray-800 text-sm line-clamp-3">
            {body?.text || 'Template body text...'}
          </p>
        </div>
        
        {/* Buttons Preview */}
        {buttons?.enabled && buttons.items?.length > 0 && (
          <div className="border-t border-gray-200 px-3 py-2 flex flex-wrap gap-1">
            {buttons.items.slice(0, 2).map((btn, i) => (
              <span key={i} className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded">
                {btn.text}
              </span>
            ))}
            {buttons.items.length > 2 && (
              <span className="text-xs text-gray-400">+{buttons.items.length - 2} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppPreview;
