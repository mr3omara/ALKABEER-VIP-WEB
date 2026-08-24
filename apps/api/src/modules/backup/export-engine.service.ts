import { Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ExportEngineService {
  public readonly SHEET_EXPORT_MAIN = 'تصدير_الكبير';
  public readonly SHEET_OPENING_BALANCES = 'أرصدة_افتتاحية_الكبير';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export Full Account Excel Workbook matching the official Master Template
   */
  async exportFullAccount(): Promise<{ buffer: Buffer; filename: string; stats: any }> {
    const [customers, lines] = await Promise.all([
      this.prisma.customer.findMany({
        where: { deletedAt: null },
        orderBy: { customerCode: 'asc' },
      }),
      this.prisma.line.findMany({
        include: {
          customer: true,
          company: true,
        },
        orderBy: [{ customer: { customerCode: 'asc' } }, { phoneNumber: 'asc' }],
      }),
    ]);

    // Sheet 1: تصدير_الكبير (11 columns)
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

    const mainRows: any[][] = [mainHeader];

    for (const line of lines) {
      const customer = line.customer;
      const company = line.company;

      // Extract and format renewal date
      let renewalDateStr = '';
      if (line.renewalDate) {
        const dObj = new Date(line.renewalDate);
        if (!isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          renewalDateStr = `${d}/${m}/${y}`;
        }
      } else if (line.paymentDay) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(Math.min(28, line.paymentDay)).padStart(2, '0');
        renewalDateStr = `${d}/${m}/${y}`;
      }

      let activationDateStr = '';
      if (line.activationDate) {
        const dObj = new Date(line.activationDate);
        if (!isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          activationDateStr = `${d}/${m}/${y}`;
        }
      } else if (line.createdAt) {
        const dObj = new Date(line.createdAt);
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        activationDateStr = `${d}/${m}/${y}`;
      }

      mainRows.push([
        customer?.customerCode || 'UNASSIGNED',
        company?.code || company?.name || 'عام',
        line.phoneNumber,
        customer?.name || customer?.shortName || '',
        line.monthlyPackage || line.salePrice || 0,
        line.monthlyPackage ? `باقة ${line.monthlyPackage}` : 'باقة قياسية',
        activationDateStr,
        renewalDateStr,
        line.notes || customer?.notes || '',
        customer?.fullName || customer?.motherGrandpaName || '',
        customer?.nationalId || '',
      ]);
    }

    // Sheet 2: أرصدة_افتتاحية_الكبير (3 columns)
    const openingHeader = ['كود العميل', 'اسم العميل', 'إجمالي المديونية (افتتاحي)'];
    const openingRows: any[][] = [openingHeader];

    for (const customer of customers) {
      openingRows.push([
        customer.customerCode,
        customer.name,
        customer.openingBalance || 0,
      ]);
    }

    // Create Excel Workbook
    const workbook = XLSX.utils.book_new();

    const mainWorksheet = XLSX.utils.aoa_to_sheet(mainRows);
    const openingWorksheet = XLSX.utils.aoa_to_sheet(openingRows);

    // Set RTL direction
    mainWorksheet['!views'] = [{ rightToLeft: true }];
    openingWorksheet['!views'] = [{ rightToLeft: true }];

    XLSX.utils.book_append_sheet(workbook, mainWorksheet, this.SHEET_EXPORT_MAIN);
    XLSX.utils.book_append_sheet(workbook, openingWorksheet, this.SHEET_OPENING_BALANCES);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const today = new Date().toISOString().split('T')[0];
    const filename = `النسخه_الاحتياطيه_${today}.xlsx`;

    return {
      buffer,
      filename,
      stats: {
        totalLines: lines.length,
        totalCustomers: customers.length,
        totalOpeningBalances: customers.filter((c) => c.openingBalance > 0).length,
      },
    };
  }

  /**
   * Export Single Company Lines Workbook matching the official Master Template
   */
  async exportCompany(companyIdOrCode: string): Promise<{ buffer: Buffer; filename: string; stats: any }> {
    const company = await this.prisma.company.findFirst({
      where: {
        OR: [{ id: companyIdOrCode }, { code: companyIdOrCode.toUpperCase() }, { name: companyIdOrCode }],
      },
    });

    if (!company) {
      throw new NotFoundException(`شركة الاتصالات [${companyIdOrCode}] غير موجودة`);
    }

    const lines = await this.prisma.line.findMany({
      where: { companyId: company.id },
      include: {
        customer: true,
        company: true,
      },
      orderBy: [{ customer: { customerCode: 'asc' } }, { phoneNumber: 'asc' }],
    });

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

    const mainRows: any[][] = [mainHeader];

    for (const line of lines) {
      const customer = line.customer;

      let renewalDateStr = '';
      if (line.renewalDate) {
        const dObj = new Date(line.renewalDate);
        if (!isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          renewalDateStr = `${d}/${m}/${y}`;
        }
      } else if (line.paymentDay) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(Math.min(28, line.paymentDay)).padStart(2, '0');
        renewalDateStr = `${d}/${m}/${y}`;
      }

      let activationDateStr = '';
      if (line.activationDate) {
        const dObj = new Date(line.activationDate);
        if (!isNaN(dObj.getTime())) {
          const y = dObj.getFullYear();
          const m = String(dObj.getMonth() + 1).padStart(2, '0');
          const d = String(dObj.getDate()).padStart(2, '0');
          activationDateStr = `${d}/${m}/${y}`;
        }
      } else if (line.createdAt) {
        const dObj = new Date(line.createdAt);
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        activationDateStr = `${d}/${m}/${y}`;
      }

      mainRows.push([
        customer?.customerCode || 'UNASSIGNED',
        company.code || company.name,
        line.phoneNumber,
        customer?.name || customer?.shortName || '',
        line.monthlyPackage || line.salePrice || 0,
        line.monthlyPackage ? `باقة ${line.monthlyPackage}` : 'باقة قياسية',
        activationDateStr,
        renewalDateStr,
        line.notes || customer?.notes || '',
        customer?.fullName || customer?.motherGrandpaName || '',
        customer?.nationalId || '',
      ]);
    }

    const workbook = XLSX.utils.book_new();
    const mainWorksheet = XLSX.utils.aoa_to_sheet(mainRows);
    mainWorksheet['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(workbook, mainWorksheet, this.SHEET_EXPORT_MAIN);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const today = new Date().toISOString().split('T')[0];
    const filename = `تصدير_شركة_${company.code}_${today}.xlsx`;

    return {
      buffer,
      filename,
      stats: {
        companyCode: company.code,
        companyName: company.name,
        totalLines: lines.length,
      },
    };
  }
}
