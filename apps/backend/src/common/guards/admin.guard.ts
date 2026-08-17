import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../../users/users.service';

/**
 * Gate for the admin dashboard API (product rule #47). Reuses the normal
 * JWT check, then additionally requires `user.isAdmin` in the database —
 * deliberately not a separate static "admin key" header, so admin access
 * is tied to a real account and can be revoked per-user.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly jwtGuard = new (AuthGuard('jwt'))();

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await this.jwtGuard.canActivate(context);
    if (!isAuthenticated) return false;

    const request = context.switchToHttp().getRequest();
    const user = await this.usersService.findById(request.user.userId);
    if (!user?.isAdmin) {
      throw new ForbiddenException("Accès réservé à l'administration.");
    }
    return true;
  }
}
