import { Injectable, InternalServerErrorException } from "@nestjs/common";

export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class KeycloakAdminService {
  // Derive base URL from issuer: "http://keycloak:8080/realms/crash-game" → "http://keycloak:8080"
  private readonly baseUrl: string;
  private readonly realm: string;
  private readonly adminUser = process.env.KEYCLOAK_ADMIN_USER ?? "admin";
  private readonly adminPass = process.env.KEYCLOAK_ADMIN_PASS ?? "admin";

  constructor() {
    const issuer = process.env.KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/crash-game";
    const realmIndex = issuer.indexOf("/realms/");
    this.baseUrl = realmIndex !== -1 ? issuer.slice(0, realmIndex) : issuer;
    this.realm = issuer.split("/realms/")[1] ?? "crash-game";
  }

  private async getAdminToken(): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/realms/master/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "password",
          client_id: "admin-cli",
          username: this.adminUser,
          password: this.adminPass,
        }),
      },
    );
    if (!res.ok) {
      throw new InternalServerErrorException("Failed to obtain Keycloak admin token");
    }
    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  async listUsers(): Promise<KeycloakUser[]> {
    const token = await this.getAdminToken();
    const res = await fetch(
      `${this.baseUrl}/admin/realms/${this.realm}/users?max=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new InternalServerErrorException(`Keycloak list users failed: ${res.status}`);
    return res.json() as Promise<KeycloakUser[]>;
  }

  async createUser(payload: CreateUserPayload): Promise<string> {
    const token = await this.getAdminToken();
    const res = await fetch(
      `${this.baseUrl}/admin/realms/${this.realm}/users`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: payload.username,
          email: payload.email,
          firstName: payload.firstName ?? "",
          lastName: payload.lastName ?? "",
          enabled: true,
          emailVerified: true,
          credentials: [{ type: "password", value: payload.password, temporary: false }],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { errorMessage?: string };
      throw new InternalServerErrorException(body.errorMessage ?? `Keycloak create user failed: ${res.status}`);
    }
    const location = res.headers.get("Location") ?? "";
    return location.split("/").pop() ?? "";
  }

  async deleteUser(userId: string): Promise<void> {
    const token = await this.getAdminToken();
    const res = await fetch(
      `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) throw new InternalServerErrorException(`Keycloak delete user failed: ${res.status}`);
  }
}
