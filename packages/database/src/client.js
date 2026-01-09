"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
var index_js_1 = require("../generated/prisma/index.js");
var extension_accelerate_1 = require("@prisma/extension-accelerate");
var createPrismaClient = function () { return new index_js_1.PrismaClient().$extends((0, extension_accelerate_1.withAccelerate)()); };
var globalForPrisma = global;
exports.prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = exports.prisma;
