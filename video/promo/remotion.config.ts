import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setColorSpace('bt709');
// En el contenedor de Claude: REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
