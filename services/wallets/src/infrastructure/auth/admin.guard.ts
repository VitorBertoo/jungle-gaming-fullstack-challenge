import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminKey = process.env.ADMIN_API_KEY ?? "admin-secret";

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const key = request.headers["x-admin-key"];
    if (key !== this.adminKey) {
      throw new UnauthorizedException("Invalid admin key");
    }
    return true;
  }
}
