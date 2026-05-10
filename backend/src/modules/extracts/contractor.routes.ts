import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import prisma from '../../prisma/client';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();
router.use(authenticate);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Excel column mapping (Arabic + English) ──────────────
function parseRow(row: any) {
  return {
    code:   (row['code']   || row['الكود']               || '').toString().trim() || undefined,
    name:   (row['name']   || row['الاسم']    || row['الاسم بالإنجليزية'] || '').toString().trim(),
    nameAr: (row['nameAr'] || row['الاسم بالعربي']       || '').toString().trim() || undefined,
    phone:  (row['phone']  || row['الهاتف']               || '').toString().trim() || undefined,
    email:  (row['email']  || row['البريد الإلكتروني']   || '').toString().trim() || undefined,
  };
}

// GET all contractors with search
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, active } = req.query as Record<string, string>;
    const where: any = {};
    if (active !== 'all') where.isActive = true;
    if (search) {
      where.OR = [
        { code:   { contains: search, mode: 'insensitive' } },
        { name:   { contains: search, mode: 'insensitive' } },
        { nameAr: { contains: search, mode: 'insensitive' } },
        { phone:  { contains: search, mode: 'insensitive' } },
        { email:  { contains: search, mode: 'insensitive' } },
      ];
    }
    const data = await prisma.contractor.findMany({
      where, orderBy: { name: 'asc' },
      include: { _count: { select: { extracts: true } } },
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// GET single
router.get('/export', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contractors = await prisma.contractor.findMany({
      where: { isActive: true }, orderBy: { name: 'asc' },
    });
    const rows = contractors.map(c => ({
      'الكود': c.code || '',
      'الاسم': c.name,
      'الاسم بالعربي': c.nameAr || '',
      'الهاتف': c.phone || '',
      'البريد الإلكتروني': c.email || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'المقاولون');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="contractors.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { next(e); }
});

// GET Excel template (empty sheet with headers + example row)
router.get('/template', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = [
      { 'الكود': 'C001', 'الاسم': 'Al-Nile Contracting', 'الاسم بالعربي': 'شركة النيل للمقاولات', 'الهاتف': '01012345678', 'البريد الإلكتروني': 'info@alnile.com' },
      { 'الكود': 'C002', 'الاسم': 'Delta Works Co.', 'الاسم بالعربي': 'شركة دلتا للأعمال', 'الهاتف': '01098765432', 'البريد الإلكتروني': '' },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'المقاولون');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="contractors_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.contractor.findUnique({
      where: { id: +req.params.id },
      include: { _count: { select: { extracts: true } } },
    });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// POST import from Excel (SUPERVISOR+)
router.post('/import', upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 4) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rawRows.length) return res.status(400).json({ success: false, message: 'الملف فارغ' });

    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const parsed = parseRow(rawRows[i]);
      if (!parsed.name) { errors.push(`صف ${i + 2}: الاسم مطلوب`); skipped++; continue; }

      try {
        if (parsed.code) {
          // Upsert by code
          const existing = await prisma.contractor.findUnique({ where: { code: parsed.code } });
          if (existing) {
            await prisma.contractor.update({ where: { code: parsed.code }, data: parsed });
            updated++;
          } else {
            await prisma.contractor.create({ data: { ...parsed, code: parsed.code } });
            created++;
          }
        } else {
          // Create without code
          await prisma.contractor.create({ data: parsed });
          created++;
        }
      } catch (err: any) {
        errors.push(`صف ${i + 2} (${parsed.name}): ${err.message}`);
        skipped++;
      }
    }

    res.json({ success: true, data: { created, updated, skipped, errors } });
  } catch (e) { next(e); }
});

// POST create (SUPERVISOR+)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 4) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { code, name, nameAr, phone, email } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
    const data = await prisma.contractor.create({
      data: { code: code?.trim() || undefined, name: name.trim(), nameAr, phone, email },
    });
    res.status(201).json({ success: true, data });
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ success: false, message: 'الكود مستخدم من قبل' });
    next(e);
  }
});

// PUT update (SUPERVISOR+)
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 4) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { code, name, nameAr, phone, email, isActive } = req.body;
    const data = await prisma.contractor.update({
      where: { id: +req.params.id },
      data: { code: code?.trim() || null, name, nameAr, phone, email, isActive },
    });
    res.json({ success: true, data });
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ success: false, message: 'الكود مستخدم من قبل' });
    next(e);
  }
});

// DELETE soft (ADMIN+)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user!.roleLevel ?? 99) > 2) return res.status(403).json({ success: false, message: 'Forbidden' });
    await prisma.contractor.update({ where: { id: +req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Deactivated' });
  } catch (e) { next(e); }
});

export default router;
