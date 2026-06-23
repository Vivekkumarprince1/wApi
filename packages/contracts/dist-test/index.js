"use strict";
/**
 * @wapi/contracts
 *
 * Shared types between the monolith (`server/`), the microservices
 * (`automation-service/`, `campaign-service/`, `billing-service/`), and
 * the Next.js frontend.
 *
 * Adoption is incremental: services can import from here piece by piece
 * to replace duplicated local definitions. The first targets are the
 * worker-bridge action map, the automation action map, the billing saga
 * events, and the Socket.io event payloads.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./worker-bridge"), exports);
__exportStar(require("./automation-actions"), exports);
__exportStar(require("./billing-events"), exports);
__exportStar(require("./socket-events"), exports);
__exportStar(require("./common"), exports);
__exportStar(require("./queues"), exports);
__exportStar(require("./roles"), exports);
__exportStar(require("./redis-config"), exports);
