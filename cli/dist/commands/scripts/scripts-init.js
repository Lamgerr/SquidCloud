import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { logSuccess } from '../../lib/output/logger.js';
import { brand } from '../../lib/output/brand.js';
export default async function scriptsInit() {
    const answers = await inquirer.prompt([
        { type: 'input', name: 'name', message: 'Pipeline name:', validate: (v) => v.length > 0 },
        { type: 'input', name: 'description', message: 'Description:', default: '' },
        {
            type: 'list',
            name: 'trigger',
            message: 'Trigger type:',
            choices: ['manual', 'schedule', 'file_change', 'webhook'],
            default: 'manual',
        },
    ]);
    const yaml = `# ${answers.name}
# ${answers.description || 'SquidScript pipeline'}

name: ${answers.name}
description: ${answers.description || ''}
trigger: ${answers.trigger}

steps:
  - name: example-step
    action: log
    params:
      message: "Hello from SquidScript!"
`;
    const filePath = path.join(process.cwd(), '.squid.yml');
    fs.writeFileSync(filePath, yaml, 'utf-8');
    logSuccess(`Created ${brand('.squid.yml')} — run \`squidcloud scripts validate\` to check it`);
}
//# sourceMappingURL=scripts-init.js.map