/**
 * VARIABLE SERVICE
 * Handles string interpolation for automation messages and templates.
 * Supports: 
 * - {{contact.name}}, {{contact.phone}}, {{contact.email}}
 * - {{workspace.name}}
 * - {{Column Name}} (from raw metadata/row data)
 */
export class VariableService {
  /**
   * Interpolate a string with given context
   */
  static interpolate(text: string, context: { 
    contact?: any; 
    workspace?: any; 
    metadata?: any;
    [key: string]: any;
  }): string {
    if (!text) return '';

    return text.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();

      // 1. Check dot notation (e.g. contact.name)
      if (trimmedKey.includes('.')) {
        const parts = trimmedKey.split('.');
        let current: any = context;
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            current = undefined;
            break;
          }
        }
        if (current !== undefined) return String(current);
      }

      // 2. Check direct metadata/row keys (case-sensitive)
      if (context.metadata && trimmedKey in context.metadata) {
        return String(context.metadata[trimmedKey]);
      }

      // 3. Check direct context keys
      if (trimmedKey in context) {
        return String(context[trimmedKey]);
      }

      // 4. Case-insensitive fallback for row data (e.g. {{Name}} vs {{name}})
      if (context.metadata) {
        const entries = Object.entries(context.metadata);
        const match = entries.find(([k]) => k.toLowerCase() === trimmedKey.toLowerCase());
        if (match) return String(match[1]);
      }

      return match; // Return original if no match
    });
  }

  /**
   * Hydrate template components with variables
   */
  static hydrateComponents(components: any[], context: any): any[] {
    if (!Array.isArray(components)) return components;

    return components.map(comp => {
      if (comp.parameters) {
        return {
          ...comp,
          parameters: comp.parameters.map((param: any) => {
            const val = param.text || param.value;
            if (typeof val === 'string' && val.includes('{{')) {
              return {
                ...param,
                [param.text ? 'text' : 'value']: this.interpolate(val, context)
              };
            }
            return param;
          })
        };
      }
      return comp;
    });
  }
}
