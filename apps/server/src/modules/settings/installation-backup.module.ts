import { Module, type DynamicModule } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { BACKUP_CONFIG, InstallationBackupController, type BackupConfig } from "./infrastructure/installation-backup.controller.js";

@Module({})
export class InstallationBackupModule {
  static with(config: BackupConfig): DynamicModule {
    return { module: InstallationBackupModule, imports: [IdentityModule], controllers: [InstallationBackupController],
      providers: [{ provide: BACKUP_CONFIG, useValue: config }] };
  }
}
