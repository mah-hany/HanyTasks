"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const client_1 = __importDefault(require("../../prisma/client"));
const multer_1 = __importDefault(require("multer"));
const exceljs_1 = __importDefault(require("exceljs"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        if (file.originalname.match(/\.(xlsx|xls)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    },
});
// ── Column mapping helper (Arabic + English headers) ──────
function parseRow(row) {
    const get = (keys) => keys.map(k => String(row[k] ?? '').trim()).find(v => v) || undefined;
    return {
        code: get(['code', 'الكود']),
        name: get(['name', 'الاسم', 'الاسم بالإنجليزية']) ?? '',
        nameAr: get(['nameAr', 'الاسم بالعربي']),
        phone: get(['phone', 'الهاتف']),
        email: get(['email', 'البريد الإلكتروني']),
    };
}
// ── Helper: write Excel workbook and send response ────────
async function sendWorkbook(res, filename, rows, sheetName = 'المقاولون') {
    const wb = new exceljs_1.default.Workbook();
    wb.creator = 'HanyTasks';
    wb.created = new Date();
    const ws = wb.addWorksheet(sheetName);
    ws.columns = [
        { header: 'الكود', key: 'code', width: 14 },
        { header: 'الاسم', key: 'name', width: 32 },
        { header: 'الاسم بالعربي', key: 'nameAr', width: 32 },
        { header: 'الهاتف', key: 'phone', width: 18 },
        { header: 'البريد الإلكتروني', key: 'email', width: 32 },
    ];
    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' },
        };
    });
    // Data rows
    rows.forEach((r, idx) => {
        const row = ws.addRow(r);
        row.eachCell(cell => {
            cell.alignment = { vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
            if (idx % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });
    const raw = await wb.xlsx.writeBuffer();
    const buf = Buffer.from(raw);
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.send(buf);
}
// ── GET all contractors (with optional search) ─────────────
router.get('/', async (req, res, next) => {
    try {
        const { search, active } = req.query;
        const where = {};
        if (active !== 'all')
            where.isActive = true;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { nameAr: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        const data = await client_1.default.contractor.findMany({
            where, orderBy: { name: 'asc' },
            include: { _count: { select: { extracts: true } } },
        });
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
// ── GET /export — Export all contractors to Excel ──────────
// ⚠️ Must be registered BEFORE GET /:id
router.get('/export', async (_req, res, next) => {
    try {
        const contractors = await client_1.default.contractor.findMany({
            where: { isActive: true }, orderBy: { name: 'asc' },
        });
        const rows = contractors.map(c => ({
            code: c.code ?? '',
            name: c.name,
            nameAr: c.nameAr ?? '',
            phone: c.phone ?? '',
            email: c.email ?? '',
        }));
        const date = new Date().toISOString().slice(0, 10);
        await sendWorkbook(res, `contractors_${date}.xlsx`, rows);
    }
    catch (e) {
        next(e);
    }
});
// ── GET /template — Download blank Excel template ──────────
// ⚠️ Must be registered BEFORE GET /:id
router.get('/template', async (_req, res, next) => {
    try {
        const rows = [
            { code: 'C001', name: 'Al-Nile Contracting', nameAr: 'شركة النيل للمقاولات', phone: '01012345678', email: 'info@alnile.com' },
            { code: 'C002', name: 'Delta Works Co.', nameAr: 'شركة دلتا للأعمال', phone: '01098765432', email: '' },
        ];
        await sendWorkbook(res, 'contractors_template.xlsx', rows);
    }
    catch (e) {
        next(e);
    }
});
// ── GET /:id — Get single contractor ──────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id))
            return res.status(400).json({ success: false, message: 'Invalid ID' });
        const data = await client_1.default.contractor.findUnique({
            where: { id },
            include: { _count: { select: { extracts: true } } },
        });
        if (!data)
            return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, data });
    }
    catch (e) {
        next(e);
    }
});
// ── POST /import — Import from Excel (SUPERVISOR+) ────────
router.post('/import', upload.single('file'), async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 4)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        if (!req.file)
            return res.status(400).json({ success: false, message: 'لم يتم رفع ملف' });
        const wb = new exceljs_1.default.Workbook();
        // Convert multer Buffer to ArrayBuffer to satisfy ExcelJS type requirements
        const ab = req.file.buffer.buffer.slice(req.file.buffer.byteOffset, req.file.buffer.byteOffset + req.file.buffer.byteLength);
        await wb.xlsx.load(ab);
        const ws = wb.worksheets[0];
        if (!ws)
            return res.status(400).json({ success: false, message: 'الملف لا يحتوي على صفحات' });
        // Read headers from row 1
        const headerRow = ws.getRow(1);
        const headers = {};
        headerRow.eachCell((cell, col) => {
            headers[col] = String(cell.value ?? '').trim();
        });
        // Collect data rows (skip header)
        const rawRows = [];
        ws.eachRow((row, rowNum) => {
            if (rowNum === 1)
                return;
            const obj = {};
            row.eachCell((cell, col) => {
                const h = headers[col];
                if (h)
                    obj[h] = cell.value ?? '';
            });
            if (Object.values(obj).some(v => v !== '' && v !== null && v !== undefined)) {
                rawRows.push(obj);
            }
        });
        if (!rawRows.length)
            return res.status(400).json({ success: false, message: 'الملف فارغ أو لا يحتوي على بيانات' });
        let created = 0, updated = 0, skipped = 0;
        const errors = [];
        for (let i = 0; i < rawRows.length; i++) {
            const parsed = parseRow(rawRows[i]);
            if (!parsed.name) {
                errors.push(`صف ${i + 2}: الاسم مطلوب`);
                skipped++;
                continue;
            }
            try {
                if (parsed.code) {
                    // Upsert by code
                    const existing = await client_1.default.contractor.findUnique({ where: { code: parsed.code } });
                    if (existing) {
                        await client_1.default.contractor.update({
                            where: { code: parsed.code },
                            data: { name: parsed.name, nameAr: parsed.nameAr, phone: parsed.phone, email: parsed.email },
                        });
                        updated++;
                    }
                    else {
                        await client_1.default.contractor.create({ data: parsed });
                        created++;
                    }
                }
                else {
                    // Create without code (or find by name to avoid dupes)
                    const existing = await client_1.default.contractor.findFirst({ where: { name: parsed.name } });
                    if (existing) {
                        await client_1.default.contractor.update({ where: { id: existing.id }, data: { nameAr: parsed.nameAr, phone: parsed.phone, email: parsed.email } });
                        updated++;
                    }
                    else {
                        await client_1.default.contractor.create({ data: parsed });
                        created++;
                    }
                }
            }
            catch (err) {
                errors.push(`صف ${i + 2} (${parsed.name}): ${err.message}`);
                skipped++;
            }
        }
        res.json({ success: true, data: { created, updated, skipped, errors } });
    }
    catch (e) {
        next(e);
    }
});
// ── POST / — Create contractor (SUPERVISOR+) ──────────────
router.post('/', async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 4)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        const { code, name, nameAr, phone, email } = req.body;
        if (!name?.trim())
            return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
        const data = await client_1.default.contractor.create({
            data: { code: code?.trim() || undefined, name: name.trim(), nameAr, phone, email },
        });
        res.status(201).json({ success: true, data });
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(400).json({ success: false, message: 'الكود مستخدم من قبل' });
        next(e);
    }
});
// ── PUT /:id — Update contractor (ADMIN+) ─────────────────
router.put('/:id', async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 2)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        const id = parseInt(req.params.id, 10);
        if (isNaN(id))
            return res.status(400).json({ success: false, message: 'Invalid ID' });
        const { code, name, nameAr, phone, email, isActive } = req.body;
        const data = await client_1.default.contractor.update({
            where: { id },
            data: { code: code?.trim() || null, name, nameAr, phone, email, isActive },
        });
        res.json({ success: true, data });
    }
    catch (e) {
        if (e.code === 'P2002')
            return res.status(400).json({ success: false, message: 'الكود مستخدم من قبل' });
        next(e);
    }
});
// ── DELETE /:id — Soft-delete contractor (ADMIN+) ─────────
router.delete('/:id', async (req, res, next) => {
    try {
        if ((req.user.roleLevel ?? 99) > 2)
            return res.status(403).json({ success: false, message: 'Forbidden' });
        const id = parseInt(req.params.id, 10);
        if (isNaN(id))
            return res.status(400).json({ success: false, message: 'Invalid ID' });
        await client_1.default.contractor.update({ where: { id }, data: { isActive: false } });
        res.json({ success: true, message: 'Deactivated' });
    }
    catch (e) {
        next(e);
    }
});
exports.default = router;
//# sourceMappingURL=contractor.routes.js.map