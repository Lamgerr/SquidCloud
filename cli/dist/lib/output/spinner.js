import ora from 'ora';
import chalk from 'chalk';
import { isCI, isJsonMode } from './index.js';
const SPINNER_FRAMES = {
    dots: { spinner: 'dots' },
    moon: { spinner: 'moon' },
    arc: { spinner: 'arc' },
    bounce: { spinner: 'bounce' },
    shark: { spinner: { interval: 120, frames: ['▸   ', '▸▸  ', '▸▸▸ ', '▸▸▸▸', ' ▸▸▸▸', '  ▸▸▸', '   ▸▸', '    ▸'] } },
};
export function createSpinner(text, style = 'shark') {
    if (isCI() || isJsonMode()) {
        const silent = {
            ...ora({ text, spinner: 'dots' }),
            start: () => { if (!isCI())
                console.log(text); return silent; },
            stop: () => { if (!isCI())
                console.log(); return silent; },
            succeed: () => { if (!isCI())
                console.log(`${chalk.green('✓')} ${text}`); return silent; },
            fail: () => { if (!isCI())
                console.log(`${chalk.red('✗')} ${text}`); return silent; },
            warn: () => { if (!isCI())
                console.log(`${chalk.hex('#FF9800')('⚠')} ${text}`); return silent; },
            info: () => { if (!isCI())
                console.log(`${chalk.hex('#4FC3F7')('ℹ')} ${text}`); return silent; },
            stopAndPersist: () => { if (!isCI())
                console.log(`${text}`); return silent; },
            clear: () => { return silent; },
            render: () => { return silent; },
            frame: () => ' ',
            text,
            isSpinning: false,
            indent: 0,
            color: 'cyan',
            prefixText: '',
            spinner: { interval: 100, frames: [''] },
        };
        return silent;
    }
    return ora({ text, ...SPINNER_FRAMES[style] }).start();
}
//# sourceMappingURL=spinner.js.map