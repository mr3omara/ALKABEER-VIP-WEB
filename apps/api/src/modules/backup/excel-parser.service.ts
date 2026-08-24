import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Money } from '@alkabeer/shared';

export interface ParsedLineRow {
  rowNumber: number;
  customerCode: string;
  companyCode: string;
  phoneNumber: string;
  customerName: string;
  monthlyPackage: number;
  packageName: string;
  activationDate?: string;
  renewalDate?: string;
  paymentDay: number;
  notes?: string;
  fullName?: string;
  nationalId?: string;
}

export interface ParsedOpeningBalanceRow {
  rowNumber: number;
  customerCode: string;
  customerName: string;
  openingDebt: number;
}

export interface ParsedWorkbookData {
  lines: ParsedLineRow[];
  openingBalances: Map<string, number>;
  customersMap: Map<string, {
    customerCode: string;
    name: string;
    fullName?: string;
    nationalId?: string;
    notes?: string;
    openingBalance: number;
    lines: ParsedLineRow[];
  }>;
  companiesSet: Set<string>;
  packagesMap: Map<string, { name: string; sellingPrice: number; companyCode?: string }>;
  stats: {
    totalRows: number;
    validLinesCount: number;
    uniqueCustomersCount: number;
    uniqueCompaniesCount: number;
    uniquePackagesCount: number;
    openingBalancesCount: number;
  };
  errors: Array<{ rowNumber: number; field: string; message: string }>;
  warnings: Array<{ rowNumber: number; field: string; message: string }>;
}

@Injectable()
export class ExcelParserService {
  public readonly SHEET_EXPORT_MAIN = 'تصدير_الكبير';
  public readonly SHEET_OPENING_BALANCES = 'أرصدة_افتتاحية_الكبير';

  /**
   * Parse a full Master Template Excel Workbook Buffer
   */
  parseMasterWorkbook(fileBuffer: Buffer): ParsedWorkbookData {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
    } catch (err: any) {
      throw new BadRequestException(`فشل قراءة ملف Excel: ${err?.message || 'الملف تالف أو غير صالح'}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestException('ملف Excel لا يحتوي على أي صفحات (Sheets)');
    }

    // Locate Sheet 1 (تصدير_الكبير)
    const mainSheetName = workbook.SheetNames.find(
      (s) => s.trim() === this.SHEET_EXPORT_MAIN || s.includes('تصدير') || s.includes('الكبير'),
    ) || workbook.SheetNames[0];

    const mainWorksheet = workbook.Sheets[mainSheetName];
    if (!mainWorksheet) {
      throw new BadRequestException(`الصفحة الأساسية [${this.SHEET_EXPORT_MAIN}] غير موجودة في ملف Excel`);
    }

    // Locate Sheet 2 (أرصدة_افتتاحية_الكبير)
    const openingSheetName = workbook.SheetNames.find(
      (s) => s.trim() === this.SHEET_OPENING_BALANCES || s.includes('أرصدة') || s.includes('افتتاحية') || s.includes('ارصدة'),
    );

    const errors: Array<{ rowNumber: number; field: string; message: string }> = [];
    const warnings: Array<{ rowNumber: number; field: string; message: string }> = [];

    // 1. Parse Opening Balances (Sheet 2)
    const openingBalancesMap = new Map<string, number>();
    const seenOpeningCodes = new Map<string, number>();
    if (openingSheetName && workbook.Sheets[openingSheetName]) {
      const openingRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[openingSheetName], {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (openingRows.length > 1) {
        // Skip header row
        for (let i = 1; i < openingRows.length; i++) {
          const row = openingRows[i];
          if (!row || row.length === 0) continue;

          const rawCode = String(row[0] || '').trim();
          const rawDebt = row[2] !== undefined ? row[2] : row[1];
          const debtNumber = this.parseMoneyInteger(rawDebt);

          if (rawCode) {
            const upperCode = rawCode.toUpperCase();
            if (seenOpeningCodes.has(upperCode)) {
              warnings.push({
                rowNumber: i + 1,
                field: 'كود العميل (أرصدة افتتاحية)',
                message: `كود العميل [${rawCode}] مكرر في صف الأرصدة الافتتاحية ${i + 1} (ظهر مسبقاً في الصف ${seenOpeningCodes.get(upperCode)})`,
              });
            } else {
              seenOpeningCodes.set(upperCode, i + 1);
              openingBalancesMap.set(upperCode, debtNumber);
            }
          }
        }
      }
    }

    // 2. Parse Main Lines (Sheet 1)
    const mainRows: any[][] = XLSX.utils.sheet_to_json(mainWorksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (mainRows.length < 2) {
      throw new BadRequestException('ملف Excel لا يحتوي على صفوف بيانات كافية (مطلوب صف العناوين وبيانات العملاء)');
    }

    const headerRow = mainRows[0].map((h) => String(h || '').trim());
    this.validateHeaderColumns(headerRow, warnings);

    const parsedLines: ParsedLineRow[] = [];
    const seenPhoneNumbers = new Map<string, number>(); // phone -> rowNumber
    const customersMap = new Map<string, {
      customerCode: string;
      name: string;
      fullName?: string;
      nationalId?: string;
      notes?: string;
      openingBalance: number;
      lines: ParsedLineRow[];
    }>();
    const companiesSet = new Set<string>();
    const packagesMap = new Map<string, { name: string; sellingPrice: number; companyCode?: string }>();

    for (let rowIndex = 1; rowIndex < mainRows.length; rowIndex++) {
      const row = mainRows[rowIndex];
      if (!row || row.length === 0 || row.every((c) => String(c).trim() === '')) {
        continue; // Skip empty rows
      }

      const excelRowNum = rowIndex + 1; // 1-based row index in Excel

      const customerCode = String(row[0] || '').trim().toUpperCase();
      const companyCode = String(row[1] || '').trim();
      const rawPhoneNumber = String(row[2] || '').trim();
      const customerName = String(row[3] || '').trim();
      const rawMonthlyPkg = row[4];
      const packageName = String(row[5] || '').trim() || 'باقة قياسية';
      const rawActivationDate = row[6];
      const rawRenewalDate = row[7];
      const notes = String(row[8] || '').trim();
      const fullName = String(row[9] || '').trim();
      const nationalId = String(row[10] || '').trim();

      // Required fields validation
      if (!customerCode) {
        errors.push({ rowNumber: excelRowNum, field: 'كود العميل', message: 'كود العميل مفقود في هذا الصف' });
        continue;
      }

      if (!companyCode) {
        errors.push({ rowNumber: excelRowNum, field: 'الشركة', message: 'اسم أو كود الشركة مفقود في هذا الصف' });
        continue;
      }

      const normalizedPhone = this.normalizePhoneNumber(rawPhoneNumber);
      if (!normalizedPhone) {
        errors.push({
          rowNumber: excelRowNum,
          field: 'رقم الخط',
          message: `رقم الهاتف [${rawPhoneNumber}] غير صالح (يجب أن يكون 10 أو 11 رقم مصري)`,
        });
        continue;
      }

      // Duplicate Phone Number Check (Line phone uniqueness rule)
      if (seenPhoneNumbers.has(normalizedPhone)) {
        errors.push({
          rowNumber: excelRowNum,
          field: 'رقم الخط',
          message: `رقم الخط [${normalizedPhone}] مكرر في الصف ${excelRowNum} (تم ظهوره مسبقاً في الصف ${seenPhoneNumbers.get(normalizedPhone)})`,
        });
        continue;
      }
      seenPhoneNumbers.set(normalizedPhone, excelRowNum);

      if (!customerName && !fullName) {
        errors.push({ rowNumber: excelRowNum, field: 'اسم العميل', message: 'اسم العميل مفقود في هذا الصف' });
        continue;
      }

      if (
        rawMonthlyPkg !== undefined &&
        rawMonthlyPkg !== '' &&
        isNaN(Number(String(rawMonthlyPkg).replace(/,/g, '').trim()))
      ) {
        errors.push({
          rowNumber: excelRowNum,
          field: 'الباقة الشهرية',
          message: `قيمة الباقة الشهرية [${rawMonthlyPkg}] غير صحيحة (يجب أن تكون قيمة رقمية)`,
        });
        continue;
      }

      const monthlyPackage = this.parseMoneyInteger(rawMonthlyPkg);
      const activationDate = this.parseExcelDate(rawActivationDate);
      const renewalDate = this.parseExcelDate(rawRenewalDate);

      // Payment day strictly derived from renewalDate (if available) or default to 1
      let paymentDay = 1;
      if (renewalDate) {
        const d = new Date(renewalDate);
        if (!isNaN(d.getTime())) {
          paymentDay = d.getDate();
        }
      }

      const lineRow: ParsedLineRow = {
        rowNumber: excelRowNum,
        customerCode,
        companyCode: companyCode || 'عام',
        phoneNumber: normalizedPhone,
        customerName: customerName || fullName || customerCode,
        monthlyPackage,
        packageName,
        activationDate,
        renewalDate,
        paymentDay,
        notes: notes || undefined,
        fullName: fullName || undefined,
        nationalId: nationalId || undefined,
      };

      parsedLines.push(lineRow);

      if (lineRow.companyCode) {
        companiesSet.add(lineRow.companyCode);
      }

      // Package registration key [name + price]
      const pkgKey = `${lineRow.packageName.toLowerCase()}__${lineRow.monthlyPackage}`;
      if (!packagesMap.has(pkgKey)) {
        packagesMap.set(pkgKey, {
          name: lineRow.packageName,
          sellingPrice: lineRow.monthlyPackage,
          companyCode: lineRow.companyCode,
        });
      }

      // Group into Customer Map (Customer Deduplication: 1 Customer -> N Lines)
      if (!customersMap.has(customerCode)) {
        const openingBalance = openingBalancesMap.get(customerCode) || 0;
        customersMap.set(customerCode, {
          customerCode,
          name: lineRow.customerName,
          fullName: lineRow.fullName,
          nationalId: lineRow.nationalId,
          notes: lineRow.notes,
          openingBalance,
          lines: [lineRow],
        });
      } else {
        const existingCust = customersMap.get(customerCode)!;
        existingCust.lines.push(lineRow);
        // Enrich missing details if subsequent rows have fuller data
        if (!existingCust.fullName && lineRow.fullName) existingCust.fullName = lineRow.fullName;
        if (!existingCust.nationalId && lineRow.nationalId) existingCust.nationalId = lineRow.nationalId;
        if (!existingCust.notes && lineRow.notes) existingCust.notes = lineRow.notes;
      }
    }

    return {
      lines: parsedLines,
      openingBalances: openingBalancesMap,
      customersMap,
      companiesSet,
      packagesMap,
      stats: {
        totalRows: mainRows.length - 1,
        validLinesCount: parsedLines.length,
        uniqueCustomersCount: customersMap.size,
        uniqueCompaniesCount: companiesSet.size,
        uniquePackagesCount: packagesMap.size,
        openingBalancesCount: openingBalancesMap.size,
      },
      errors,
      warnings,
    };
  }

  // Egyptian Landline Area Code Prefixes (without leading 0)
  private static readonly LANDLINE_2DIGIT_PREFIXES_NO_ZERO = [
    '40', '45', '46', '47', '48', // الدلتا والقناة
    '50', '55', '57',
    '62', '64', '65', '66', '68',
    '82', '84', '86', '88', '89', // الصعيد وسيناء
    '93', '95', '96', '97',
  ];

  /**
   * Phone Number Normalization & Validation:
   * Supports both Egyptian Mobile (010, 011, 012, 015) and Landline (02, 03, 040, 045, etc.)
   */
  normalizePhoneNumber(raw: any): string | null {
    if (!raw) return null;
    const clean = String(raw).replace(/\D/g, '');
    if (!clean) return null;

    // ----------------------------------------------------
    // 1. MOBILE NUMBERS
    // ----------------------------------------------------
    // 10 digits starting with 10, 11, 12, 15 -> prepend 0 -> 11 digits
    if (clean.length === 10 && /^(10|11|12|15)\d{8}$/.test(clean)) {
      return '0' + clean;
    }
    // 11 digits starting with 010, 011, 012, 015 -> accept as is
    if (clean.length === 11 && /^(010|011|012|015)\d{8}$/.test(clean)) {
      return clean;
    }

    // ----------------------------------------------------
    // 2. LANDLINE NUMBERS (Cairo & Giza: 02)
    // ----------------------------------------------------
    // 9 digits starting with 2 -> prepend 0 -> 10 digits (02XXXXXXXX)
    if (clean.length === 9 && clean.startsWith('2')) {
      return '0' + clean;
    }
    // 10 digits starting with 02 -> accept as is (02XXXXXXXX)
    if (clean.length === 10 && clean.startsWith('02')) {
      return clean;
    }

    // ----------------------------------------------------
    // 3. LANDLINE NUMBERS (Alexandria: 03)
    // ----------------------------------------------------
    // 8 digits starting with 3 -> prepend 0 -> 9 digits (03XXXXXXX)
    if (clean.length === 8 && clean.startsWith('3')) {
      return '0' + clean;
    }
    // 9 digits starting with 03 -> accept as is (03XXXXXXX)
    if (clean.length === 9 && clean.startsWith('03')) {
      return clean;
    }

    // ----------------------------------------------------
    // 4. LANDLINE NUMBERS (Governorates with 3-digit code: 040, 045, 050, 055, etc.)
    // ----------------------------------------------------
    // 9 digits without leading 0: starts with valid 2-digit prefix -> prepend 0 -> 10 digits (e.g. 453942433 -> 0453942433)
    if (clean.length === 9) {
      const prefix2 = clean.slice(0, 2);
      if (ExcelParserService.LANDLINE_2DIGIT_PREFIXES_NO_ZERO.includes(prefix2)) {
        return '0' + clean;
      }
    }
    // 10 digits with leading 0: starts with 0 + valid 2-digit prefix -> accept as is (e.g. 0453818181)
    if (clean.length === 10 && clean.startsWith('0')) {
      const prefix2 = clean.slice(1, 3);
      if (ExcelParserService.LANDLINE_2DIGIT_PREFIXES_NO_ZERO.includes(prefix2)) {
        return clean;
      }
    }

    // Invalid format, length, or unknown prefix
    return null;
  }

  /**
   * Safe Money/Integer parser ensuring zero floating-point corruption
   */
  parseMoneyInteger(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return Math.round(val);
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : Math.round(num);
  }

  /**
   * Excel Date Parser handling Serial numbers, Date instances, and date strings (DD/MM/YYYY, YYYY-MM-DD)
   */
  parseExcelDate(val: any): string | undefined {
    if (!val) return undefined;

    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }

    if (typeof val === 'number') {
      // Excel serial date formula
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }

    const str = String(val).trim();
    if (!str) return undefined;

    // DD/MM/YYYY format
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = ddmmyyyyMatch[1].padStart(2, '0');
      const month = ddmmyyyyMatch[2].padStart(2, '0');
      const year = ddmmyyyyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // YYYY-MM-DD format
    const yyyymmddMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (yyyymmddMatch) {
      const year = yyyymmddMatch[1];
      const month = yyyymmddMatch[2].padStart(2, '0');
      const day = yyyymmddMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }

    return undefined;
  }

  private validateHeaderColumns(headers: string[], warnings: Array<{ rowNumber: number; field: string; message: string }>) {
    const expectedHeaders = [
      'كود العميل',
      'الشركة',
      'رقم الخط',
      'اسم العميل',
      'الباقة الشهرية',
      'فلكس',
      'تاريخ التشغيل',
      'تاريخ التجديد',
      'ملاحظات',
      'الاسم بالكامل / الجد',
      'رقم قومي',
    ];

    expectedHeaders.forEach((expected, idx) => {
      const actual = headers[idx];
      if (!actual || !actual.includes(expected)) {
        warnings.push({
          rowNumber: 1,
          field: expected,
          message: `عنوان العمود رقم ${idx + 1} هو [${actual || 'فارغ'}] بينما المتوقع هو [${expected}]`,
        });
      }
    });
  }
}
