#!/usr/bin/env -S node --experimental-strip-types

import { Command, CommanderError } from "commander";

import packageMetadata from "../package.json" with { type: "json" };
import { listBuilderProfiles } from "./builder/profiles.ts";
import { createBuilderCommand } from "./cli/builder.ts";
import { createValidatorCommand } from "./cli/validator.ts";

const packageVersion = packageMetadata.version;

function builderProfilesHelp(): string {
  const profiles = listBuilderProfiles()
    .map((profile) => `  ${profile.id} (${profile.maturity})`)
    .join("\n");
  return `\nBuilder profiles:\n${profiles}`;
}

function configureCommandTree(command: Command): void {
  command.exitOverride().configureOutput({ writeErr: () => {} });
  for (const subcommand of command.commands) {
    configureCommandTree(subcommand);
  }
}

/**
 * Builds the root `depositor` command tree.
 *
 * The command includes validator, builder, and help routes.
 * The function does not parse process arguments or generate artifacts.
 *
 * @returns The function returns a configured Commander command.
 */
export function createCli(): Command {
  const program = new Command()
    .name("depositor")
    .description(
      "Offline Ethereum validator and experimental ePBS builder artifact generator"
    )
    .version(packageVersion)
    .showHelpAfterError()
    .enablePositionalOptions()
    .allowExcessArguments();

  program
    .addCommand(createValidatorCommand(packageVersion))
    .addCommand(createBuilderCommand())
    .helpCommand(true)
    .addHelpText("after", builderProfilesHelp())
    .action(() => {
      const [unknownCommand] = program.args;
      if (unknownCommand) {
        throw new Error(`Unknown command: ${unknownCommand}`);
      }
      program.help();
    });

  configureCommandTree(program);

  return program;
}

function normalizeCommanderError(error: CommanderError): Error {
  const message = error.message
    .replace(/^error:\s*/i, "")
    .replace(/(unknown option '--[^'=]+)=[^']+(')/i, "$1$2");
  return new Error(`${message.charAt(0).toUpperCase()}${message.slice(1)}`);
}

/**
 * Parses CLI arguments and runs the selected offline artifact workflow.
 *
 * The default input excludes the Node.js executable and script path.
 * Validator and builder commands can write keys, recovery material, and JSON artifacts.
 * Help and version commands return without generating artifacts.
 *
 * @param args This list contains CLI arguments. The default is `process.argv.slice(2)`.
 * @returns The promise resolves after the selected command completes.
 * @throws The function throws if arguments, safety policy, or artifact generation fail.
 */
export async function main(
  args: readonly string[] = process.argv.slice(2)
): Promise<void> {
  try {
    await createCli().parseAsync([...args], { from: "user" });
  } catch (error) {
    if (
      error instanceof CommanderError &&
      [
        "commander.help",
        "commander.helpDisplayed",
        "commander.version",
      ].includes(error.code)
    ) {
      return;
    }
    if (error instanceof CommanderError) {
      throw normalizeCommanderError(error);
    }
    throw error;
  }
}
