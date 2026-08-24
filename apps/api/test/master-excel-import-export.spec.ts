import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { ExcelParserService } from '../src/modules/backup/excel-parser.service';

describe('Master Excel Engine: Import / Export / Backup Integrity', () => {
  const parser = new ExcelParserService();

  const createMockMasterWorkbook = (): Buffer => {
    const mainHeader = [
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

    const mainRows = [
      mainHeader,
      // Multi-line customer 1: KA-1012 with 2 lines
      [
        'KA-1012',
        'Y20',
        '1080777622',
        'عوض بدران عنب',
        115,
        '2025 Business Flex 80',
        '01/01/2025',
        '20/08/2026',
        'خط رئيسي',
        'عوض بدران محمد عنب',
        '29001011234567',
      ],
      [
        'KA-1012',
        'Y20',
        '1080777522',
        'عوض بدران عنب',
        115,
        '2025 Business Flex 80',
        '01/01/2025',
        '20/08/2026',
        'خط إضافي',
        'عوض بدران محمد عنب',
        '29001011234567',
      ],
      // Single line customer 2: KA-1086 with specific renewal date not matching company code
      [
        'KA-1086',
        'M7',
        '01012345678',
        'محمود سعيد',
        200,
        'Etisalat Emerald 200',
        '15/02/2025',
        '07/08/2026',
        'عميل VIP',
        'محمود سعيد علي حسن',
        '28505051234567',
      ],
      // Customer 3: KA-1007 with S25 company
      [
        'KA-1007',
        'S25',
        '1022266648',
        'أحمد طارق',
        150,
        'Vodafone Red',
        '10/03/2025',
        '25/08/2026',
        'حساب شركات',
        'أحمد طارق خليل إبراهيم',
        '29202021234567',
      ],
    ];

    const openingHeader = ['كود العميل', 'اسم العميل', 'إجمالي المديونية (افتتاحي)'];
    const openingRows = [
      openingHeader,
      ['KA-1086', 'محمود سعيد', 4410],
      ['KA-1012', 'عوض بدران عنب', 0],
      ['KA-1007', 'أحمد طارق', 1250],
    ];

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(mainRows);
    const s2 = XLSX.utils.aoa_to_sheet(openingRows);

    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    XLSX.utils.book_append_sheet(wb, s2, 'أرصدة_افتتاحية_الكبير');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  it('1. Successfully parses Sheet 1 (تصدير_الكبير) and Sheet 2 (أرصدة_افتتاحية_الكبير)', () => {
    const buffer = createMockMasterWorkbook();
    const parsed = parser.parseMasterWorkbook(buffer);

    expect(parsed.errors.length).toBe(0);
    expect(parsed.lines.length).toBe(4);
    expect(parsed.customersMap.size).toBe(3); // KA-1012, KA-1086, KA-1007
    expect(parsed.companiesSet.size).toBe(3); // Y20, M7, S25
    expect(parsed.openingBalances.size).toBe(3);
  });

  it('2. Customer Deduplication: Multi-line customer (KA-1012) produces exactly 1 customer record with 2 lines', () => {
    const buffer = createMockMasterWorkbook();
    const parsed = parser.parseMasterWorkbook(buffer);

    const cust1012 = parsed.customersMap.get('KA-1012');
    expect(cust1012).toBeDefined();
    expect(cust1012!.name).toBe('عوض بدران عنب');
    expect(cust1012!.lines.length).toBe(2);
    expect(cust1012!.lines[0].phoneNumber).toBe('01080777622');
    expect(cust1012!.lines[1].phoneNumber).toBe('01080777522');
  });

  it('3. Phone Number Normalization: Converts 10-digit numbers into standard 11-digit Egyptian format (010...)', () => {
    const buffer = createMockMasterWorkbook();
    const parsed = parser.parseMasterWorkbook(buffer);

    const line1007 = parsed.lines.find((l) => l.customerCode === 'KA-1007');
    expect(line1007).toBeDefined();
    expect(line1007!.phoneNumber).toBe('01022266648'); // 1022266648 -> 01022266648
  });

  it('4. Opening Balances: Correctly mapped by Customer Code (KA-1086 = 4410, KA-1007 = 1250)', () => {
    const buffer = createMockMasterWorkbook();
    const parsed = parser.parseMasterWorkbook(buffer);

    expect(parsed.openingBalances.get('KA-1086')).toBe(4410);
    expect(parsed.openingBalances.get('KA-1007')).toBe(1250);
    expect(parsed.openingBalances.get('KA-1012')).toBe(0);

    const cust1086 = parsed.customersMap.get('KA-1086');
    expect(cust1086?.openingBalance).toBe(4410);
  });

  it('5. Renewal Date Single Source of Truth: Preserves exact dates from Excel without deriving from company name', () => {
    const buffer = createMockMasterWorkbook();
    const parsed = parser.parseMasterWorkbook(buffer);

    const lineM7 = parsed.lines.find((l) => l.customerCode === 'KA-1086');
    expect(lineM7?.renewalDate).toBe('2026-08-07');
    expect(lineM7?.paymentDay).toBe(7);

    const lineS25 = parsed.lines.find((l) => l.customerCode === 'KA-1007');
    expect(lineS25?.renewalDate).toBe('2026-08-25');
    expect(lineS25?.paymentDay).toBe(25);
  });

  it('6. Error Reporting: Identifies and reports rows with invalid phone numbers or missing customer codes', () => {
    const corruptRows = [
      ['كود العميل', 'الشركة', 'رقم الخط', 'اسم العميل', 'الباقة الشهرية', 'فلكس', 'تاريخ التشغيل', 'تاريخ التجديد', 'ملاحظات', 'الاسم بالكامل / الجد', 'رقم قومي'],
      ['', 'VF', '01012345678', 'بدون كود', 100, 'فليكس', '', '', '', '', ''], // Missing code
      ['KA-9999', 'VF', '123', 'رقم تالف', 100, 'فليكس', '', '', '', '', ''], // Bad phone
    ];

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(corruptRows);
    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    const badBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parser.parseMasterWorkbook(badBuffer);
    expect(parsed.errors.length).toBe(2);
    expect(parsed.errors[0].field).toBe('كود العميل');
    expect(parsed.errors[1].field).toBe('رقم الخط');
  });

  describe('Phone Number Normalization & Validation Unit Tests (Mobile + Landline)', () => {
    it('normalizes Egyptian Mobile numbers correctly (10 & 11 digits for 010, 011, 012, 015)', () => {
      // 10 digits without leading 0 -> prepend 0
      expect(parser.normalizePhoneNumber('1022266648')).toBe('01022266648');
      expect(parser.normalizePhoneNumber('1122334455')).toBe('01122334455');
      expect(parser.normalizePhoneNumber('1222334455')).toBe('01222334455');
      expect(parser.normalizePhoneNumber('1522334455')).toBe('01522334455');

      // 11 digits with leading 0 -> preserve as is
      expect(parser.normalizePhoneNumber('01022266648')).toBe('01022266648');
      expect(parser.normalizePhoneNumber('01122334455')).toBe('01122334455');
      expect(parser.normalizePhoneNumber('01222334455')).toBe('01222334455');
      expect(parser.normalizePhoneNumber('01522334455')).toBe('01522334455');
    });

    it('normalizes Egyptian Landline numbers across governorate area codes', () => {
      // El Beheira (045)
      expect(parser.normalizePhoneNumber('453942433')).toBe('0453942433');
      expect(parser.normalizePhoneNumber('0453818181')).toBe('0453818181');

      // Cairo & Giza (02)
      expect(parser.normalizePhoneNumber('237654321')).toBe('0237654321');
      expect(parser.normalizePhoneNumber('0237654321')).toBe('0237654321');

      // Alexandria (03)
      expect(parser.normalizePhoneNumber('34876543')).toBe('034876543');
      expect(parser.normalizePhoneNumber('034876543')).toBe('034876543');

      // Delta & Canal Governorates: Gharbia (040), Daqahliya (050), Sharqiya (055), Port Said (062)
      expect(parser.normalizePhoneNumber('403333333')).toBe('0403333333');
      expect(parser.normalizePhoneNumber('0403333333')).toBe('0403333333');
      expect(parser.normalizePhoneNumber('502222222')).toBe('0502222222');
      expect(parser.normalizePhoneNumber('0502222222')).toBe('0502222222');
      expect(parser.normalizePhoneNumber('551234567')).toBe('0551234567');
      expect(parser.normalizePhoneNumber('0551234567')).toBe('0551234567');
      expect(parser.normalizePhoneNumber('623456789')).toBe('0623456789');

      // Upper Egypt & Red Sea: Aswan (097), Luxor (095), Sohag (093), Minya (086)
      expect(parser.normalizePhoneNumber('971234567')).toBe('0971234567');
      expect(parser.normalizePhoneNumber('0971234567')).toBe('0971234567');
      expect(parser.normalizePhoneNumber('951234567')).toBe('0951234567');
      expect(parser.normalizePhoneNumber('0951234567')).toBe('0951234567');
      expect(parser.normalizePhoneNumber('931234567')).toBe('0931234567');
      expect(parser.normalizePhoneNumber('861234567')).toBe('0861234567');
    });

    it('strictly rejects invalid lengths, invalid prefixes, or random numbers', () => {
      expect(parser.normalizePhoneNumber('')).toBeNull();
      expect(parser.normalizePhoneNumber(null)).toBeNull();
      expect(parser.normalizePhoneNumber('123456')).toBeNull(); // too short
      expect(parser.normalizePhoneNumber('010123456')).toBeNull(); // 9 digits mobile (invalid)
      expect(parser.normalizePhoneNumber('1812345678')).toBeNull(); // invalid mobile prefix 18
      expect(parser.normalizePhoneNumber('771234567')).toBeNull(); // invalid area code 77
      expect(parser.normalizePhoneNumber('0771234567')).toBeNull(); // invalid area code 077
      expect(parser.normalizePhoneNumber('0101234567899')).toBeNull(); // too long
    });
  });
});

