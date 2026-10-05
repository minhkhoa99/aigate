import { Controller, Get, Module, type DynamicModule } from "@nestjs/common";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import { ToolingController } from "./tooling.controller.js";
import { ConsoleLogService } from "./console-log.service.js";
import { CodexSettingsController } from "./codex-settings.controller.js";
import { CodexSettingsService } from "./codex-settings.service.js";
import { ClaudeSettingsController } from "./claude-settings.controller.js";
import { ClaudeSettingsService } from "./claude-settings.service.js";
import { OpenCodeSettingsController } from "./opencode-settings.controller.js";
import { OpenCodeSettingsService } from "./opencode-settings.service.js";
import { ClineSettingsController } from "./cline-settings.controller.js";
import { ClineSettingsService } from "./cline-settings.service.js";
import { DroidSettingsController } from "./droid-settings.controller.js";
import { DroidSettingsService } from "./droid-settings.service.js";
import { CopilotSettingsController } from "./copilot-settings.controller.js";
import { CopilotSettingsService } from "./copilot-settings.service.js";
import { ManagedJsonSettingsController } from "./managed-json-settings.controller.js";
import { ManagedJsonSettingsService } from "./managed-json-settings.service.js";
import { ManagedTomlSettingsController } from "./managed-toml-settings.controller.js";
import { ManagedTomlSettingsService } from "./managed-toml-settings.service.js";
import { KiloSettingsController } from "./kilo-settings.controller.js";
import { KiloSettingsService } from "./kilo-settings.service.js";
import { OpenClawSettingsController } from "./openclaw-settings.controller.js";
import { OpenClawSettingsService } from "./openclaw-settings.service.js";
import { HermesSettingsController } from "./hermes-settings.controller.js";
import { HermesSettingsService } from "./hermes-settings.service.js";
import { JcodeSettingsController } from "./jcode-settings.controller.js";
import { JcodeSettingsService } from "./jcode-settings.service.js";
import { OmpSettingsController } from "./omp-settings.controller.js";
import { OmpSettingsService } from "./omp-settings.service.js";
import { GrokBuildSettingsController } from "./grok-build-settings.controller.js";
import { GrokBuildSettingsService } from "./grok-build-settings.service.js";
import { ApiKeysModule } from "../apikeys/apikeys.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { TunnelController } from "./tunnel.controller.js";
import { TunnelService } from "./tunnel.service.js";
import { McpController } from "./mcp.controller.js";
import { McpServerStore, TOOLING_DATA_DIR } from "./mcp-server.store.js";
import { McpMarketplaceController } from "./mcp-marketplace.controller.js";
import { McpMarketplaceService } from "./mcp-marketplace.service.js";
import { MitmController } from "./mitm.controller.js";
import { MitmService } from "./mitm.service.js";

const home = homedir();
const tools = [
  ["claude", "Claude Code", "claude", ".claude/settings.json"],
  ["codex", "Codex", "codex", ".codex/config.toml"],
  ["cursor", "Cursor", "cursor", ".cursor/mcp.json"],
  ["gemini", "Gemini CLI", "gemini", ".gemini/settings.json"],
  ["cline", "Cline", "cline", ".cline/data/globalState.json"],
  ["opencode", "OpenCode", "opencode", ".config/opencode/opencode.json"],
  ["copilot", "Copilot CLI", "copilot", ".config/github-copilot/hosts.json"],
  ["droid", "Droid", "droid", ".factory/settings.json"],
  ["openclaw", "OpenClaw", "openclaw", ".openclaw/openclaw.json"],
  ["hermes", "Hermes", "hermes", ".hermes/config.yaml"],
  ["kilo", "Kilo Code", "kilo", ".local/share/kilo/auth.json"],
  ["deepseek-tui", "DeepSeek TUI", "deepseek", ".deepseek/config.toml"],
  ["jcode", "JCode", "jcode", ".jcode/config.toml"],
  ["grok-build", "Grok Build", "grok", ".grok/config.toml"],
  ["devin", "Devin", "devin", ".devin/config.json"],
  ["codewhale", "CodeWhale", "codewhale", ".codewhale/config.toml"],
  ["forge", "Forge", "forge", ".forge/config.toml"],
  ["crush", "Crush", "crush", ".config/crush/crush.json"],
  ["pi", "Pi", "pi", ".pi/agent/settings.json"],
  ["smelt", "Smelt", "smelt", ".config/smelt/settings.json"],
  ["omp", "Oh My Pi", "omp", ".omp/agent/models.yml"],
] as const;

function installed(command: string): boolean {
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  return (process.env.PATH ?? "").split(delimiter).some((directory) =>
    extensions.some((extension) => executable(join(directory, `${command}${extension}`)) || executable(join(directory, `${command}${extension.toLowerCase()}`))),
  );
}

function executable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (process.platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}

@Controller("api/tooling")
class CliToolsController {
  @Get("cli-tools")
  listCliTools() {
    return tools.map(([id, name, command, relativeConfig]) => {
      const configPath = join(home, relativeConfig);
      const configExists = isFile(configPath);
      const isInstalled = installed(command);
      return { id, name, installed: isInstalled, configExists, status: configExists ? "configured" : isInstalled ? "available" : "not_detected", configPath: configExists ? configPath : null };
    });
  }
}

@Module({})
export class ToolingModule {}

export function toolingModule(dataDir: string): DynamicModule {
  return {
    module: ToolingModule,
    imports: [ApiKeysModule, IdentityModule, SettingsModule],
    controllers: [ToolingController, CliToolsController, CodexSettingsController, ClaudeSettingsController, OpenCodeSettingsController, ClineSettingsController, DroidSettingsController, CopilotSettingsController, ManagedJsonSettingsController, ManagedTomlSettingsController, KiloSettingsController, OpenClawSettingsController, HermesSettingsController, JcodeSettingsController, OmpSettingsController, GrokBuildSettingsController, TunnelController, McpController, McpMarketplaceController, MitmController],
    providers: [ConsoleLogService, CodexSettingsService, ClaudeSettingsService, OpenCodeSettingsService, ClineSettingsService, DroidSettingsService, CopilotSettingsService, ManagedJsonSettingsService, ManagedTomlSettingsService, KiloSettingsService, OpenClawSettingsService, HermesSettingsService, JcodeSettingsService, OmpSettingsService, GrokBuildSettingsService, TunnelService, McpServerStore, McpMarketplaceService, MitmService, { provide: TOOLING_DATA_DIR, useValue: dataDir }],
  };
}
