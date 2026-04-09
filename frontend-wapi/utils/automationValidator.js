/**
 * automationValidator.js - Stage 6 Workflow Engine
 * 
 * Performs graph analysis on workflows to detect:
 * 1. Infinite Loops (Cycles)
 * 2. Orphaned Nodes (Unreachable from trigger)
 * 3. Configuration Errors (Missing required fields)
 */

export const validateWorkflow = (nodes, edges) => {
  const errors = [];
  const warnings = [];
  
  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) {
    errors.push({ id: 'global', message: 'Workflow must have a trigger node.' });
    return { errors, warnings };
  }

  // 1. Build Adjacency List
  const adj = {};
  nodes.forEach(n => adj[n.id] = []);
  edges.forEach(e => {
    if (adj[e.source]) {
      adj[e.source].push(e.target);
    }
  });

  // 2. Loop Detection (DFS)
  const hasCycle = () => {
    const visited = new Set();
    const recStack = new Set();
    const cycles = [];

    const dfs = (u) => {
      visited.add(u);
      recStack.add(u);

      const neighbors = adj[u] || [];
      for (const v of neighbors) {
        if (!visited.has(v)) {
          if (dfs(v)) return true;
        } else if (recStack.has(v)) {
          cycles.push(v);
          return true;
        }
      }

      recStack.delete(u);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }
    return false;
  };

  if (hasCycle()) {
    warnings.push({ id: 'global', message: 'Potential Infinite Loop detected. Ensure your flow eventually terminates or has delays.' });
  }

  // 3. Reachability (Identify Orphans)
  const reachableFromTrigger = new Set();
  const reachDfs = (u) => {
    reachableFromTrigger.add(u);
    const neighbors = adj[u] || [];
    for (const v of neighbors) {
      if (!reachableFromTrigger.has(v)) {
        reachDfs(v);
      }
    }
  };
  reachDfs(triggerNode.id);

  nodes.forEach(n => {
    if (!reachableFromTrigger.has(n.id)) {
      warnings.push({ id: n.id, message: 'Node is unreachable from the trigger.' });
    }
  });

  // 4. Configuration Validation
  nodes.forEach(n => {
    if (n.type === 'message' && n.data.type === 'send_template_message' && !n.data.config.templateId) {
      errors.push({ id: n.id, message: 'Template not selected.' });
    }
    if (n.type === 'message' && n.data.type === 'send_text_message' && !n.data.config.messageContent) {
      errors.push({ id: n.id, message: 'Message content is empty.' });
    }
    if (n.data.type === 'notify_webhook' && !n.data.config.webhookUrl) {
      errors.push({ id: n.id, message: 'Webhook URL missing.' });
    }
    if (n.data.type === 'add_tag' && !n.data.config.tagName) {
      errors.push({ id: n.id, message: 'Tag name not specified.' });
    }
  });

  return { errors, warnings };
};
