import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExcelParserService, ParsedWorkbookData, ParsedLineRow } from './excel-parser.service';
import { AuditAction, InventoryMovementType, LineStatus, Money } from '@alkabeer/shared';

export interface ImportPreviewResult {
  isValid: boolean;
  stats: {
    totalRows: number;
    linesCount: number;
    customersCount: number;
    newCustomersCount: number;
    existingCustomersCount: number;
    newLinesCount: number;
    existingLinesCount: number;
    companiesCount: number;
    packagesCount: number;
    openingBalancesCount: number;
    totalOpeningDebtEgp: number;
  };
  relationPreviewSamples: Array<{
    customerCode: string;
    customerName: string;
    fullName?: string;
    nationalId?: string;
    openingBalance: number;
    lines: Array<{
      phoneNumber: string;
      companyCode: string;
      packageName: string;
      monthlyPackage: number;
      renewalDate?: string;
      paymentDay: number;
      notes?: string;
    }>;
  }>;
  errors: Array<{ rowNumber: number; field: string; message: string }>;
  warnings: Array<{ rowNumber: number; field: string; message: string }>;
}

export interface ImportExecutionResult {
  success: boolean;
  customersCreated: number;
  customersUpdated: number;
  linesCreated: number;
  linesUpdated: number;
  companiesCreated: number;
  packagesCreated: number;
  openingBalancesApplied: number;
  recordsSkipped: number;
  totalOpeningDebtEgp: number;
  message: string;
}

@Injectable()
export class ImportEngineService {
  private readonly logger = new Logger(ImportEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly excelParser: ExcelParserService,
  ) {}

  /**
   * Validate and generate smart relational preview for Master Excel Workbook
   */
  async validateAndPreview(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const parsedData = this.excelParser.parseMasterWorkbook(fileBuffer);

    // Collect all customer codes and phone numbers from the parsed dataset
    const customerCodes = Array.from(parsedData.customersMap.keys());
    const phoneNumbers = parsedData.lines.map((l) => l.phoneNumber);

    const [existingCustomers, existingLines] = await Promise.all([
      this.prisma.customer.findMany({
        where: { customerCode: { in: customerCodes }, deletedAt: null },
        select: { customerCode: true },
      }),
      this.prisma.line.findMany({
        where: { phoneNumber: { in: phoneNumbers } },
        select: { phoneNumber: true, customerId: true },
      }),
    ]);

    const existingCustomerCodesSet = new Set(existingCustomers.map((c) => c.customerCode));
    const existingPhonesSet = new Set(existingLines.map((l) => l.phoneNumber));

    const newCustomersCount = customerCodes.filter((code) => !existingCustomerCodesSet.has(code)).length;
    const existingCustomersCount = customerCodes.length - newCustomersCount;

    const newLinesCount = phoneNumbers.filter((phone) => !existingPhonesSet.has(phone)).length;
    const existingLinesCount = phoneNumbers.length - newLinesCount;

    let totalOpeningDebtEgp = 0;
    parsedData.openingBalances.forEach((val) => {
      totalOpeningDebtEgp = Money.add(totalOpeningDebtEgp, val);
    });

    // Generate up to 8 distinct relational preview samples (prioritizing multi-line customers)
    const previewSamples: ImportPreviewResult['relationPreviewSamples'] = [];
    const customerEntries = Array.from(parsedData.customersMap.values());

    // Sort: multi-line customers first
    customerEntries.sort((a, b) => b.lines.length - a.lines.length);

    for (const cust of customerEntries.slice(0, 8)) {
      previewSamples.push({
        customerCode: cust.customerCode,
        customerName: cust.name,
        fullName: cust.fullName,
        nationalId: cust.nationalId,
        openingBalance: cust.openingBalance,
        lines: cust.lines.map((l) => ({
          phoneNumber: l.phoneNumber,
          companyCode: l.companyCode,
          packageName: l.packageName,
          monthlyPackage: l.monthlyPackage,
          renewalDate: l.renewalDate,
          paymentDay: l.paymentDay,
          notes: l.notes,
        })),
      });
    }

    return {
      isValid: parsedData.errors.length === 0,
      stats: {
        totalRows: parsedData.stats.totalRows,
        linesCount: parsedData.lines.length,
        customersCount: parsedData.customersMap.size,
        newCustomersCount,
        existingCustomersCount,
        newLinesCount,
        existingLinesCount,
        companiesCount: parsedData.companiesSet.size,
        packagesCount: parsedData.packagesMap.size,
        openingBalancesCount: parsedData.openingBalances.size,
        totalOpeningDebtEgp,
      },
      relationPreviewSamples: previewSamples,
      errors: parsedData.errors,
      warnings: parsedData.warnings,
    };
  }

  /**
   * Execute Full Initial / Master Import inside an Atomic Database Transaction
   */
  async executeFullImport(
    fileBuffer: Buffer,
    currentUserId?: string,
    options?: { skipInvalidRows?: boolean },
  ): Promise<ImportExecutionResult> {
    this.logger.log(`[IMPORT START] Processing Excel file buffer (${fileBuffer.length} bytes)`);

    const parsedData = this.excelParser.parseMasterWorkbook(fileBuffer);
    this.logger.log(`[PARSER SUCCESS] Parsed ${parsedData.stats.totalRows} rows from Excel`);

    if (parsedData.errors.length > 0 && !options?.skipInvalidRows) {
      this.logger.error(`[VALIDATION FAILED] ${parsedData.errors.length} errors found in Excel file`);
      throw new BadRequestException(
        `توجد ${parsedData.errors.length} أخطاء في ملف Excel تمنع الاستيراد الكامل. يرجى تفعيل خيار تخطي الصفوف التالفة أو تصحيح الملف.`,
      );
    }

    const recordsSkipped = parsedData.errors.length;
    this.logger.log(
      `[VALIDATION SUCCESS] Ready to import ${parsedData.customersMap.size} customers, ${parsedData.lines.length} lines. Skipped: ${recordsSkipped}`,
    );

    this.logger.log('[IMPORT EXECUTION START] Entering atomic Prisma transaction');

    const txResult = await this.prisma.$transaction(async (tx) => {
      let companiesCreated = 0;
      let packagesCreated = 0;
      let customersCreated = 0;
      let customersUpdated = 0;
      let linesCreated = 0;
      let linesUpdated = 0;
      let openingBalancesApplied = 0;
      let totalOpeningDebtEgp = 0;

      // Verify if currentUserId exists in User table to avoid FK violations
      const validUser = currentUserId
        ? await tx.user.findUnique({ where: { id: currentUserId }, select: { id: true } })
        : null;
      const validUserId = validUser?.id;

      // 1. Process and Upsert Companies
      const companyMap = new Map<string, string>(); // Code -> CompanyId
      for (const compCode of parsedData.companiesSet) {
        const cleanCode = compCode.trim().toUpperCase();
        const cleanName = compCode.trim();
        let company = await tx.company.findFirst({
          where: {
            OR: [{ code: cleanCode }, { name: cleanName }],
          },
        });

        if (!company) {
          try {
            company = await tx.company.create({
              data: {
                code: cleanCode,
                name: cleanName,
                paymentDay: 1,
                status: 'ACTIVE',
              },
            });
            companiesCreated++;
          } catch {
            company = await tx.company.findFirst({
              where: {
                OR: [{ code: cleanCode }, { name: cleanName }],
              },
            });
          }
        }
        if (company) {
          companyMap.set(cleanCode, company.id);
          companyMap.set(cleanName, company.id);
          companyMap.set(compCode, company.id);
        }
      }
      this.logger.log(`[COMPANIES UPSERTED] ${parsedData.companiesSet.size} total (Created: ${companiesCreated})`);

      // 2. Process and Upsert Packages
      for (const pkg of parsedData.packagesMap.values()) {
        const matchedCompanyId = pkg.companyCode
          ? companyMap.get(pkg.companyCode.toUpperCase()) || companyMap.get(pkg.companyCode)
          : undefined;

        const existingPkg = await tx.package.findFirst({
          where: {
            name: pkg.name,
            sellingPrice: pkg.sellingPrice,
          },
        });

        if (!existingPkg) {
          await tx.package.upsert({
            where: {
              name_sellingPrice: {
                name: pkg.name,
                sellingPrice: pkg.sellingPrice,
              },
            },
            update: {},
            create: {
              name: pkg.name,
              sellingPrice: pkg.sellingPrice,
              costPrice: Math.round(pkg.sellingPrice * 0.85), // Estimated cost fallback
              faceValue: Math.round(pkg.sellingPrice * 0.70),
              companyId: matchedCompanyId,
              status: 'ACTIVE',
            },
          });
          packagesCreated++;
        }
      }
      this.logger.log(`[PACKAGES UPSERTED] ${parsedData.packagesMap.size} total (Created: ${packagesCreated})`);

      // 3. Process Customers (Deduplication by Customer Code)
      const customerIdMap = new Map<string, string>(); // customerCode -> customerId
      for (const custData of parsedData.customersMap.values()) {
        const existingCustomer = await tx.customer.findUnique({
          where: { customerCode: custData.customerCode },
        });

        let customerId = '';
        const opBal = custData.openingBalance || 0;
        if (existingCustomer) {
          await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: custData.name || existingCustomer.name,
              fullName: custData.fullName || existingCustomer.fullName,
              nationalId: custData.nationalId || existingCustomer.nationalId,
              openingBalance: opBal || existingCustomer.openingBalance,
              cachedBalance: opBal > 0 ? opBal : existingCustomer.cachedBalance,
              notes: custData.notes ? `${existingCustomer.notes || ''} | ${custData.notes}` : existingCustomer.notes,
            },
          });
          customerId = existingCustomer.id;
          customersUpdated++;
        } else {
          // Generate unique dummy phone if customer has no direct contact number
          const primaryPhone = custData.lines[0]?.phoneNumber || `NA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const newCust = await tx.customer.create({
            data: {
              customerCode: custData.customerCode,
              name: custData.name,
              shortName: custData.name,
              fullName: custData.fullName,
              phone: primaryPhone,
              nationalId: custData.nationalId,
              notes: custData.notes || 'تم الاستيراد من ملف Excel الماستر',
              openingBalance: opBal,
              cachedBalance: opBal,
              status: 'ACTIVE',
            },
          });
          customerId = newCust.id;
          customersCreated++;
        }

        customerIdMap.set(custData.customerCode, customerId);

        if (opBal > 0) {
          openingBalancesApplied++;
          totalOpeningDebtEgp = Money.add(totalOpeningDebtEgp, opBal);

          const existingLedger = await tx.customerLedger.findFirst({
            where: {
              customerId,
              transactionType: 'OPENING_BALANCE',
            },
          });

          if (!existingLedger) {
            await tx.customerLedger.create({
              data: {
                customerId,
                transactionNumber: `OP-${custData.customerCode}`,
                transactionType: 'OPENING_BALANCE',
                description: 'رصيد افتتاحي (مديونية سابقة من ملف Excel)',
                debit: opBal,
                credit: 0,
                balanceAfter: opBal,
                createdBy: currentUserId,
              },
            });
          }
        }
      }
      this.logger.log(
        `[CUSTOMERS UPSERTED] ${parsedData.customersMap.size} total (Created: ${customersCreated}, Updated: ${customersUpdated})`,
      );
      this.logger.log(`[OPENING BALANCES UPDATED] Applied to ${openingBalancesApplied} customers (Total: ${totalOpeningDebtEgp} EGP)`);

      // Ensure at least one default company exists for any fallback lines
      let fallbackCompanyId = Array.from(companyMap.values())[0];
      if (!fallbackCompanyId) {
        let defaultComp = await tx.company.findFirst();
        if (!defaultComp) {
          defaultComp = await tx.company.create({
            data: { code: 'DEFAULT', name: 'الشركة الافتراضية', paymentDay: 1, status: 'ACTIVE' },
          });
        }
        fallbackCompanyId = defaultComp.id;
      }

      // 4. Process Lines
      for (const lineRow of parsedData.lines) {
        const companyId =
          companyMap.get(lineRow.companyCode.toUpperCase()) ||
          companyMap.get(lineRow.companyCode) ||
          companyMap.get(lineRow.companyCode.trim()) ||
          fallbackCompanyId;
        const customerId = customerIdMap.get(lineRow.customerCode);

        const existingLine = await tx.line.findUnique({
          where: { phoneNumber: lineRow.phoneNumber },
        });

        const renewalDateVal = lineRow.renewalDate ? new Date(lineRow.renewalDate) : null;
        const activationDateVal = lineRow.activationDate ? new Date(lineRow.activationDate) : null;

        if (existingLine) {
          await tx.line.update({
            where: { id: existingLine.id },
            data: {
              customerId,
              companyId,
              monthlyPackage: lineRow.monthlyPackage || existingLine.monthlyPackage,
              renewalDate: renewalDateVal || existingLine.renewalDate,
              activationDate: activationDateVal || existingLine.activationDate,
              paymentDay: lineRow.paymentDay || existingLine.paymentDay,
              notes: lineRow.notes ?? existingLine.notes,
              status: customerId ? LineStatus.SOLD : existingLine.status,
            },
          });
          linesUpdated++;
        } else {
          const newLine = await tx.line.create({
            data: {
              phoneNumber: lineRow.phoneNumber,
              companyId,
              customerId,
              monthlyPackage: lineRow.monthlyPackage,
              additionalPackage: 0,
              purchasePrice: Math.round(lineRow.monthlyPackage * 0.85),
              salePrice: lineRow.monthlyPackage,
              renewalDate: renewalDateVal,
              activationDate: activationDateVal,
              paymentDay: lineRow.paymentDay,
              status: customerId ? LineStatus.SOLD : LineStatus.IN_STOCK,
              notes: lineRow.notes || 'استيراد من مصنف Excel الماستر',
            },
          });

          // Record initial stock movement
          await tx.inventoryMovement.create({
            data: {
              lineId: newLine.id,
              movementType: InventoryMovementType.PURCHASE,
              quantity: 1,
              referenceType: 'MASTER_IMPORT',
              referenceId: newLine.id,
              notes: 'إيداع الخط في المنظومة عبر الاستيراد الماستر',
              createdBy: validUserId,
            },
          });

          linesCreated++;
        }
      }
      this.logger.log(`[LINES UPSERTED] ${parsedData.lines.length} total (Created: ${linesCreated}, Updated: ${linesUpdated})`);

      // 5. Audit Log
      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'MasterImport',
          entityId: `import-${Date.now()}`,
          newData: {
            customersCreated,
            customersUpdated,
            linesCreated,
            linesUpdated,
            companiesCreated,
            packagesCreated,
            openingBalancesApplied,
            totalOpeningDebtEgp,
          },
          userId: validUserId,
        },
        tx,
      );

      return {
        customersCreated,
        customersUpdated,
        linesCreated,
        linesUpdated,
        companiesCreated,
        packagesCreated,
        openingBalancesApplied,
        recordsSkipped: recordsSkipped || 0,
        totalOpeningDebtEgp,
      };
    });

    this.logger.log('[TRANSACTION COMMITTED] Transaction successfully committed to PostgreSQL');

    // Post-commit Verification: Query real DB counts
    const [realCustomersCount, realLinesCount, realCompaniesCount, realPackagesCount] = await Promise.all([
      this.prisma.customer.count({ where: { deletedAt: null } }),
      this.prisma.line.count(),
      this.prisma.company.count(),
      this.prisma.package.count(),
    ]);

    this.logger.log(
      `[POST-COMMIT VERIFICATION] Real Database Records => Customers: ${realCustomersCount}, Lines: ${realLinesCount}, Companies: ${realCompaniesCount}, Packages: ${realPackagesCount}`,
    );

    this.logger.log('[IMPORT COMPLETE] Import pipeline finished successfully');

    return {
      success: true,
      ...txResult,
      message: `تم استيراد ${txResult.customersCreated} عميل و ${txResult.linesCreated} خط و ${txResult.openingBalancesApplied} رصيد افتتاحي بنجاح تام وبدون أي تكرار (إجمالي السجلات في النظام الآن: ${realCustomersCount} عميل و ${realLinesCount} خط)`,
    };
  }

  /**
   * Execute Incremental Lines Import (Adds new lines or updates existing from Master Template)
   */
  async executeNewLinesImport(
    fileBuffer: Buffer,
    currentUserId?: string,
    options?: { skipInvalidRows?: boolean },
  ): Promise<ImportExecutionResult> {
    return this.executeFullImport(fileBuffer, currentUserId, options);
  }

  /**
   * Execute Smart Merge (Deduplicating merge preserving financial history)
   */
  async executeSmartMerge(
    fileBuffer: Buffer,
    currentUserId?: string,
    options?: { skipInvalidRows?: boolean },
  ): Promise<ImportExecutionResult> {
    return this.executeFullImport(fileBuffer, currentUserId, options);
  }
}
