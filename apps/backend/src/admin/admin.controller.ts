import { BadRequestException, Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { isPeriodKey, PERIOD_KEYS, type PeriodKey } from './admin-period';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Headline KPIs. `period` selects the comparison window (default 30d);
   * every figure comes back alongside the same figure over the preceding
   * window of equal length, so the UI never has to invent an evolution.
   */
  @Get('dashboard')
  getDashboard(@Query('period') period?: string) {
    return this.adminService.getDashboard(parsePeriod(period));
  }

  /** Time series behind the two dashboard charts, zero-filled per bucket. */
  @Get('series')
  getSeries(@Query('period') period?: string) {
    return this.adminService.getSeries(parsePeriod(period));
  }

  @Get('activity')
  getActivity(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.adminService.getRecentActivity(limit);
  }

  @Get('payments')
  getPayments(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.adminService.getRecentPayments(limit);
  }

  @Get('devices')
  getDevices(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.adminService.getActiveDevices(limit);
  }
}

function parsePeriod(value?: string): PeriodKey {
  if (value === undefined) return '30d';
  if (!isPeriodKey(value)) {
    throw new BadRequestException(`Période invalide. Valeurs acceptées : ${PERIOD_KEYS.join(', ')}.`);
  }
  return value;
}
