import { readdir } from 'fs/promises';
import { join } from 'path';
import { Skill, HookName, MessageContext, ActionContext } from './hooks';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private skillPaths: Map<string, string> = new Map();

  async loadSkills(skillsDir: string): Promise<Skill[]> {
    this.skills.clear();
    this.skillPaths.clear();

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(skillsDir, entry.name, 'skill.js');

        try {
          // Dynamic import of skill module
          const skillModule = await import(`file://${skillPath}`);
          const skill: Skill = skillModule.default || skillModule;

          if (!skill.name) {
            console.warn(
              `[skills] Skill in ${entry.name} missing name property, skipping`
            );
            continue;
          }

          this.skills.set(skill.name, skill);
          this.skillPaths.set(skill.name, skillPath);

          console.log(
            `[skills] Loaded skill: ${skill.name}${
              skill.description ? ` — ${skill.description}` : ''
            }`
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `[skills] Failed to load skill from ${entry.name}: ${msg}`
          );
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[skills] Error scanning skills directory: ${msg}`);
    }

    return this.list();
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  getByName(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  findByCommand(command: string): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.commands?.includes(command)) {
        return skill;
      }
    }
    return undefined;
  }

  async executeHook(
    hook: HookName,
    context?: MessageContext | ActionContext
  ): Promise<void> {
    for (const skill of this.skills.values()) {
      if (hook === 'onStartup' && skill.onStartup) {
        try {
          await skill.onStartup();
        } catch (error) {
          console.error(
            `[skills] Error in onStartup hook for ${skill.name}:`,
            error
          );
        }
      } else if (hook === 'onShutdown' && skill.onShutdown) {
        try {
          await skill.onShutdown();
        } catch (error) {
          console.error(
            `[skills] Error in onShutdown hook for ${skill.name}:`,
            error
          );
        }
      } else if (hook === 'onMessage' && skill.onMessage && context) {
        try {
          await skill.onMessage(context as MessageContext);
        } catch (error) {
          console.error(
            `[skills] Error in onMessage hook for ${skill.name}:`,
            error
          );
        }
      } else if (hook === 'beforeExecute' && skill.beforeExecute && context) {
        try {
          await skill.beforeExecute(context as ActionContext);
        } catch (error) {
          console.error(
            `[skills] Error in beforeExecute hook for ${skill.name}:`,
            error
          );
        }
      } else if (hook === 'afterExecute' && skill.afterExecute && context) {
        try {
          await skill.afterExecute(context as ActionContext, null);
        } catch (error) {
          console.error(
            `[skills] Error in afterExecute hook for ${skill.name}:`,
            error
          );
        }
      }
    }
  }

  getStats(): {
    totalSkills: number;
    skillNames: string[];
    skillCommands: Map<string, string[]>;
  } {
    const skillCommands = new Map<string, string[]>();
    for (const skill of this.skills.values()) {
      if (skill.commands) {
        skillCommands.set(skill.name, skill.commands);
      }
    }

    return {
      totalSkills: this.skills.size,
      skillNames: Array.from(this.skills.keys()),
      skillCommands,
    };
  }
}
