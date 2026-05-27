#!/usr/bin/env node

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024-2026 Gracker (Chris)
// This file is part of CameraPerf. See LICENSE for details.

/**
 * CameraPerf CLI
 *
 * Command-line tools for managing and testing skills.
 */

import { Command } from 'commander';
import { validateCommand } from './commands/validate';
import { testCommand } from './commands/test';
import { listCommand } from './commands/list';
import { smokeCommand } from './commands/smoke';
import { coverageCommand } from './commands/coverage';

const program = new Command();

program
  .name('camera-perf')
  .description('CameraPerf CLI tools for skill management')
  .version('1.0.0');

program.addCommand(validateCommand);
program.addCommand(testCommand);
program.addCommand(listCommand);
program.addCommand(smokeCommand);
program.addCommand(coverageCommand);

program.parse();
